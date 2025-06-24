# Shapes Reddit Bot

A powerful Reddit bot that integrates with the Shapes.inc API to provide AI-powered responses to mentions and comments across multiple subreddits.

## Features

- 🎯 **Multi-Subreddit Support**: Monitor multiple subreddits simultaneously
- 🤖 **AI-Powered Responses**: Uses Shapes.inc API for intelligent replies
- 🎲 **Random Reply Mode**: Optionally reply to random comments (not just mentions)
- 📊 **Real-time Statistics**: Track bot performance and activity
- 🛡️ **Error Handling**: Robust error handling with graceful degradation
- ⚡ **Configurable**: Extensive configuration options via environment variables
- 🔄 **Auto-Recovery**: Handles API failures and network issues gracefully
![image](https://github.com/user-attachments/assets/e7931bea-1ce1-4540-8481-5341826047f9)

## Prerequisites

Before running the bot, you'll need:

1. **Node.js** (version 14 or higher)
2. **Reddit App Credentials** (see setup guide below)
3. **Shapes.inc API Key** and username
4. **Reddit Account** for the bot

## Setup Guide

### 1. Clone the Repository

```bash
git clone <repository-url>
cd shape-reddit
npm install
```

### 2. Reddit App Setup

1. Go to [Reddit App Preferences](https://www.reddit.com/prefs/apps)
2. Click "Create App" or "Create Another App"
3. Fill in the form:
   - **Name**: Your bot name (e.g., "MyShapesBot")
   - **App type**: Select "script"
   - **Description**: Brief description of your bot
   - **About URL**: Leave blank or add your GitHub URL
   - **Redirect URI**: Use `http://localhost:8080` (required but not used)
4. Click "Create app"
5. Note down the **Client ID** (under the app name) and **Client Secret**

### 3. Shapes.inc Setup

1. Sign up at [Shapes.inc](https://shapes.inc)
2. Get your API key from the dashboard
3. Note your Shapes username

### 4. Environment Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your credentials:
   ```bash
   # Shapes.inc Configuration
   SHAPESINC_API_KEY=your_shapes_api_key_here
   SHAPESINC_SHAPE_USERNAME=your_shapes_username_here
   
   # Reddit Configuration
   REDDIT_CLIENT_ID=your_reddit_client_id_here
   REDDIT_CLIENT_SECRET=your_reddit_client_secret_here
   REDDIT_USERNAME=your_reddit_bot_username_here
   REDDIT_PASSWORD=your_reddit_bot_password_here
   
   # Subreddits to monitor (comma-separated, no 'r/')
   REDDIT_SUBREDDITS=test,bottest,yoursubreddit
   ```

## Configuration Options

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SHAPESINC_API_KEY` | Your Shapes.inc API key | `sk-1234567890abcdef` |
| `SHAPESINC_SHAPE_USERNAME` | Your Shapes.inc username | `myusername` |
| `REDDIT_CLIENT_ID` | Reddit app client ID | `abc123def456` |
| `REDDIT_CLIENT_SECRET` | Reddit app client secret | `secret123` |
| `REDDIT_USERNAME` | Accounts Reddit username | `MyBot` |
| `REDDIT_PASSWORD` | Accounts Reddit password | `password123` |
| `REDDIT_SUBREDDITS` | Comma-separated subreddit list | `AskReddit,programming,test` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REPLY_TO_RANDOM` | `false` | Enable random replies to comments |
| `RANDOM_REPLY_CHANCE` | `0.1` | Probability of random replies (0.0-1.0) |
| `POLL_TIME` | `5000` | Polling interval in milliseconds |
| `LIMIT` | `10` | Max comments to fetch per poll |
| `MAX_CONTENT_LENGTH` | `1000` | Max characters sent to Shapes API |

## Running the Bot

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Using PM2 (Recommended for Production)
```bash
# Install PM2 globally
npm install -g pm2

# Start the bot
pm2 start index.js --name "shapes-reddit-bot"

# View logs
pm2 logs shapes-reddit-bot

# Restart bot
pm2 restart shapes-reddit-bot

# Stop bot
pm2 stop shapes-reddit-bot
```

## How It Works

### Mention Detection
The bot monitors specified subreddits for comments containing:
- `u/yourbotusername`
- `/u/yourbotusername`

When detected, it processes the comment through the Shapes.inc API and replies.

### Random Replies (Optional)
When `REPLY_TO_RANDOM=true`, the bot will occasionally reply to random comments based on the `RANDOM_REPLY_CHANCE` setting.

### Content Processing
1. Comments are filtered and validated
2. Content is truncated if it exceeds `MAX_CONTENT_LENGTH`
3. Content is sent to Shapes.inc API with user and channel context
4. AI response is posted as a reply

## Monitoring and Statistics

The bot provides real-time statistics every minute:

```
📊 Bot Statistics (Uptime: 3600s)
   💬 Total Comments Processed: 150
   🎯 Mention Replies: 12
   🎲 Random Replies: 8
   ❌ Errors: 2
   📈 Success Rate: 95.5%
```

## Rate Limiting and Best Practices

### Reddit Rate Limits
- **Comments**: 1 per 10 minutes for new accounts, 1 per minute for established accounts
- **API Calls**: 60 requests per minute

### Recommendations
- Start with `POLL_TIME=10000` (10 seconds) to avoid rate limiting
- Use `LIMIT=5` for new accounts
- Monitor error rates and adjust polling accordingly
- Test in small subreddits first

## Error Handling

The bot includes comprehensive error handling:

- **API Failures**: Graceful degradation with error messages
- **Network Issues**: Automatic retry logic
- **Rate Limiting**: Respect Reddit's rate limits
- **Invalid Responses**: Fallback error messages

## Troubleshooting

### Common Issues

**Bot not responding to mentions:**
- Check subreddit name spelling in `REDDIT_SUBREDDITS`
- Verify bot has permission to post in the subreddit
- Check Reddit API credentials

**API errors:**
- Verify Shapes.inc API key and username
- Check API rate limits
- Monitor network connectivity

**Permission errors:**
- Ensure bot account has sufficient karma
- Check if subreddit allows bots
- Verify account is not shadowbanned

### Debug Mode

Add debug logging by modifying the poll time:
```bash
POLL_TIME=30000  # Slower polling for debugging
```

### Log Analysis

Check logs for patterns:
```bash
# If using PM2
pm2 logs shape-reddit

# If running directly
node index.js 2>&1 | tee bot.log
```

## Deployment Options

### Local Development
- Run with `npm run dev` for hot reloading
- Use `.env` file for configuration

### VPS/Cloud Server
- Use PM2 for process management
- Set up log rotation
- Monitor with systemd or similar

### Docker (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["npm", "start"]
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review existing GitHub issues
3. Create a new issue with detailed information

## Changelog

### v2.0.0
- Added multi-subreddit support
- Implemented random reply functionality
- Enhanced error handling and logging
- Added comprehensive statistics tracking
- Improved configuration options

### v1.0.0
- Initial release
- Basic mention detection and response
- Shapes.inc API integration

## Security Notes

- Never commit your `.env` file
- Use strong passwords for Reddit accounts
- Regularly rotate API keys
- Monitor bot activity for abuse
- Respect Reddit's terms of service

## Performance Tips

- Optimize `POLL_TIME` based on subreddit activity
- Use appropriate `LIMIT` values to balance responsiveness and API usage
- Monitor memory usage for long-running instances
- Consider implementing caching for frequent requests
