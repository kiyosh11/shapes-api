const dotenv = require('dotenv');
dotenv.config();

// Environment variables with validation
const SHAPES_API_KEY = process.env.SHAPESINC_API_KEY;
const SHAPES_USERNAME = process.env.SHAPESINC_SHAPE_USERNAME;
const SUBREDDITS = process.env.REDDIT_SUBREDDITS?.split(',').map(s => s.trim()) || [];
const POLL_TIME = parseInt(process.env.POLL_TIME, 10) || 5000; 
const LIMIT = parseInt(process.env.LIMIT, 10) || 10;
const REPLY_TO_RANDOM = process.env.REPLY_TO_RANDOM?.toLowerCase() === 'true' || false;
const RANDOM_REPLY_CHANCE = parseFloat(process.env.RANDOM_REPLY_CHANCE) || 0.1; // 10% chance by default
const MAX_CONTENT_LENGTH = parseInt(process.env.MAX_CONTENT_LENGTH, 10) || 1000;
const COOLDOWN_MIN = 90000; // 50 seconds
const COOLDOWN_MAX = 120000; // 60 seconds

// Required environment variable validation
const requiredEnvVars = [
    { name: 'SHAPESINC_API_KEY', value: SHAPES_API_KEY },
    { name: 'SHAPESINC_SHAPE_USERNAME', value: SHAPES_USERNAME },
    { name: 'REDDIT_CLIENT_ID', value: process.env.REDDIT_CLIENT_ID },
    { name: 'REDDIT_CLIENT_SECRET', value: process.env.REDDIT_CLIENT_SECRET },
    { name: 'REDDIT_USERNAME', value: process.env.REDDIT_USERNAME },
    { name: 'REDDIT_PASSWORD', value: process.env.REDDIT_PASSWORD }
];

for (const envVar of requiredEnvVars) {
    if (!envVar.value) {
        console.error(`❌ ${envVar.name} not found in environment variables!`);
        process.exit(1);
    }
}

if (SUBREDDITS.length === 0) {
    console.error('❌ REDDIT_SUBREDDITS not found or empty in environment variables!');
    console.error('   Please provide comma-separated subreddit names (without r/)');
    process.exit(1);
}

const Snoowrap = require('snoowrap');
const { CommentStream, SubmissionStream } = require('snoostorm');
const { OpenAI } = require('openai');

// Initialize Shapes API client
const shapes = new OpenAI({
    apiKey: SHAPES_API_KEY,
    baseURL: "https://api.shapes.inc/v1"
});

// Reddit client initialization
const client = new Snoowrap({
    userAgent: `ShapesBot:v1.0.0 (by /u/${process.env.REDDIT_USERNAME})`,
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    username: process.env.REDDIT_USERNAME,
    password: process.env.REDDIT_PASSWORD
});
const BOT_START = Date.now() / 1000;

// Statistics tracking
const stats = {
    totalComments: 0,
    totalSubmissions: 0,
    mentionReplies: 0,
    randomReplies: 0,
    errors: 0,
    startTime: new Date(),
    lastReplyTime: 0
};

// Cooldown management
let isOnCooldown = false;

/**
 * Get random cooldown duration
 */
function getRandomCooldown() {
    return Math.floor(Math.random() * (COOLDOWN_MAX - COOLDOWN_MIN + 1)) + COOLDOWN_MIN;
}

/**
 * Start cooldown period
 */
function startCooldown() {
    isOnCooldown = true;
    const cooldownDuration = getRandomCooldown();
    console.log(`⏳ Starting cooldown: ${cooldownDuration/1000} seconds`);
    
    setTimeout(() => {
        isOnCooldown = false;
        console.log("✅ Cooldown period ended");
    }, cooldownDuration);
}

/**
 * Process content with Shapes API
 */
async function processWithShapes(content, userId, channelId) {
    try {
        // Truncate content if too long
        const truncatedContent = content.length > MAX_CONTENT_LENGTH 
            ? content.substring(0, MAX_CONTENT_LENGTH) + '...' 
            : content;

        console.log(`📤 Sending to Shapes API (${truncatedContent.length} chars):`, 
                   truncatedContent.substring(0, 100) + '...');

        const headers = {
            "X-User-Id": userId
        };
        if (channelId) {
            headers["X-Channel-Id"] = channelId;
        }

        const response = await shapes.chat.completions.create({
            model: `shapesinc/${SHAPES_USERNAME}`,
            messages: [{ role: "user", content: truncatedContent }],
            extra_headers: headers
        });

        const responseText = response.choices[0]?.message?.content;
        console.log(`📥 Shapes Response (${responseText?.length || 0} chars):`, 
                   responseText?.substring(0, 100) + '...');

        return responseText?.trim() || "Sorry, the AI did not return a response.";

    } catch (error) {
        console.error('❌ Error processing with Shapes API:', error.message);
        stats.errors++;
        return `Sorry, I encountered an error while processing your request: ${error.message}`;
    }
}

/**
 * Check if bot is mentioned in text
 */
const isMentioned = (text) => {
    if (typeof text !== 'string') return false;
    const username = process.env.REDDIT_USERNAME;
    // Case-insensitive regex with word boundaries
    const mentionPattern = new RegExp(`\\bu/${username}\\b`, 'i');
    return mentionPattern.test(text);
};

/**
 * Check if item is suitable for random reply
 */
const shouldReplyRandomly = (item, isSubmission = false) => {
    if (!REPLY_TO_RANDOM) return false;
    
    const roll = Math.random();
    const shouldReply = roll <= RANDOM_REPLY_CHANCE;
    
    console.log(`🎲 Random check: ${roll.toFixed(2)} <= ${RANDOM_REPLY_CHANCE} = ${shouldReply}`);
    
    if (!shouldReply) return false;
    
    // For submissions, combine title and content
    const content = isSubmission 
        ? `${item.title} ${item.selftext || ''}` 
        : item.body;
    
    if (content.length < 10) return false;
    if (content.startsWith('[deleted]') || content.startsWith('[removed]')) return false;
    if (item.author.name === '[deleted]') return false;
    
    return true;
};

/**
 * Process and reply to a comment or submission
 */
async function processItem(item, isSubmission = false, isRandomReply = false) {
    if (isOnCooldown) {
        console.log(`⏳ Skipping reply - bot is on cooldown`);
        return;
    }
    
    const replyType = isRandomReply ? 'random' : 'mention';
    const itemType = isSubmission ? 'submission' : 'comment';
    
    console.log(`\n🎯 Processing ${replyType} reply for ${itemType} ID: ${item.id}`);
    console.log(`   👤 Author: ${item.author.name}`);
    console.log(`   📍 Subreddit: r/${item.subreddit.display_name}`);
    
    try {
        // For submissions, combine title and content
        const content = isSubmission
            ? `${item.title}\n\n${item.selftext || ''}`
            : item.body;
            
        console.log(`   💬 Content: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);

        const replyText = await processWithShapes(
            content, 
            item.author.name, 
            item.subreddit.display_name
        );

        console.log(`📝 Attempting to reply to ${itemType} ID: ${item.id}`);
        await item.reply(replyText);
        
        console.log(`✅ Successfully replied to ${itemType} ID: ${item.id}`);
        
        // Update stats and start cooldown
        if (isRandomReply) {
            stats.randomReplies++;
        } else {
            stats.mentionReplies++;
        }
        
        stats.lastReplyTime = Date.now();
        startCooldown();

    } catch (err) {
        console.error(`❌ Error processing ${itemType} ID: ${item.id}:`, err.message);
        stats.errors++;
        
        // Try to send a generic error reply
        try {
            await item.reply("Sorry, I encountered an error processing your request. Please try again later.");
        } catch (replyErr) {
            console.error(`❌ Failed to send error reply to ${itemType} ID: ${item.id}:`, replyErr.message);
        }
    }
}

/**
 * Create streams for comments and submissions
 */
function createStreams() {
    const streams = [];

    for (const subreddit of SUBREDDITS) {
        console.log(`🔄 Starting streams for r/${subreddit}`);
        
        // Comment stream
        const commentStream = new CommentStream(client, {
            subreddit: subreddit,
            limit: LIMIT,
            pollTime: POLL_TIME
        });

        commentStream.on('item', async (item) => {
            stats.totalComments++;
            
            // Skip comments from before bot started
            if (item.created_utc < BOT_START) {
                console.log(`⏩ Skipping comment ${item.id} (created before bot start)`);
                return;
            }
            
            // Skip bot's own comments
            if (item.author.name.toLowerCase() === process.env.REDDIT_USERNAME.toLowerCase()) {
                console.log(`⏩ Skipping comment ${item.id} (bot's own comment)`);
                return;
            }
            
            const isMention = isMentioned(item.body);
            const isRandom = shouldReplyRandomly(item, false);
            
            console.log(`📝 Comment ${item.id} | Mention: ${isMention} | Random: ${isRandom}`);
            
            if (isMention) {
                await processItem(item, false, false);
            } else if (isRandom) {
                await processItem(item, false, true);
            }
        });

        commentStream.on('error', (err) => {
            console.error(`❌ Comment stream error for r/${subreddit}:`, err.message);
            stats.errors++;
        });

        streams.push(commentStream);
        
        // Submission stream
        const submissionStream = new SubmissionStream(client, {
            subreddit: subreddit,
            limit: LIMIT,
            pollTime: POLL_TIME
        });

        submissionStream.on('item', async (item) => {
            stats.totalSubmissions++;
            
            // Skip submissions from before bot started
            if (item.created_utc < BOT_START) {
                console.log(`⏩ Skipping submission ${item.id} (created before bot start)`);
                return;
            }
            
            // Skip bot's own submissions
            if (item.author.name.toLowerCase() === process.env.REDDIT_USERNAME.toLowerCase()) {
                console.log(`⏩ Skipping submission ${item.id} (bot's own submission)`);
                return;
            }
            
            // Combine title and content for mention check
            const content = `${item.title} ${item.selftext || ''}`;
            const isMention = isMentioned(content);
            const isRandom = shouldReplyRandomly(item, true);
            
            console.log(`📝 Submission ${item.id} | Mention: ${isMention} | Random: ${isRandom}`);
            
            if (isMention) {
                await processItem(item, true, false);
            } else if (isRandom) {
                await processItem(item, true, true);
            }
        });

        submissionStream.on('error', (err) => {
            console.error(`❌ Submission stream error for r/${subreddit}:`, err.message);
            stats.errors++;
        });

        streams.push(submissionStream);
    }

    return streams;
}

/**
 * Print statistics periodically
 */
function startStatsLogger() {
    setInterval(() => {
        const uptime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000);
        const cooldownStatus = isOnCooldown ? `(Cooldown active)` : `(No cooldown)`;
        console.log(`\n📊 Bot Statistics (Uptime: ${uptime}s) ${cooldownStatus}`);
        console.log(`   💬 Comments Processed: ${stats.totalComments}`);
        console.log(`   📄 Submissions Processed: ${stats.totalSubmissions}`);
        console.log(`   🎯 Mention Replies: ${stats.mentionReplies}`);
        console.log(`   🎲 Random Replies: ${stats.randomReplies}`);
        console.log(`   ❌ Errors: ${stats.errors}`);
        console.log(`   📈 Success Rate: ${stats.totalComments + stats.totalSubmissions > 0 ? 
            ((stats.mentionReplies + stats.randomReplies) / (stats.totalComments + stats.totalSubmissions) * 100).toFixed(1) : 0}%`);
    }, 60000); // Every minute
}

// Graceful shutdown handling
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    console.log('📊 Final Statistics:');
    console.log(`   💬 Comments: ${stats.totalComments}`);
    console.log(`   📄 Submissions: ${stats.totalSubmissions}`);
    console.log(`   🎯 Mention Replies: ${stats.mentionReplies}`);
    console.log(`   🎲 Random Replies: ${stats.randomReplies}`);
    console.log(`   ❌ Errors: ${stats.errors}`);
    process.exit(0);
});

// Start the bot
console.log('🚀 Starting Reddit Shapes Bot...');
console.log(`📱 Bot Username: u/${process.env.REDDIT_USERNAME}`);
console.log(`📍 Monitoring Subreddits: ${SUBREDDITS.map(s => `r/${s}`).join(', ')}`);
console.log(`🎲 Random Replies: ${REPLY_TO_RANDOM ? `Enabled (${RANDOM_REPLY_CHANCE * 100}% chance)` : 'Disabled'}`);
console.log(`⏱️  Poll Time: ${POLL_TIME}ms`);
console.log(`📊 Item Limit: ${LIMIT}`);
console.log(`📏 Max Content Length: ${MAX_CONTENT_LENGTH} characters`);
console.log(`⏳ Reply Cooldown: ${COOLDOWN_MIN/1000}-${COOLDOWN_MAX/1000} seconds`);

const streams = createStreams();
startStatsLogger();

console.log('✅ Reddit bot started successfully!');
console.log(`🔍 Listening for mentions of u/${process.env.REDDIT_USERNAME} and processing content...`);
