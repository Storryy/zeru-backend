## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Create a `.env` file in the root directory:
```env
ALCHEMY_API_KEY=your_alchemy_api_key_here
REDIS_URL=redis://localhost:6379
REDIS_HOST=your_redit_host_name_here
REDIS_PASSWORD=your_redis_password_here
REDIS_PORT=your_redis_port_here
```

### 3. Start Redis
Make sure Redis is running on your machine:
```bash
# On macOS with Homebrew
brew services start redis

# On Ubuntu/Debian
sudo systemctl start redis

# Or run directly
redis-server
```

### 4. Run the Server
```bash
node server.js
```

The server will start on **http://localhost:3000** 

## API Endpoints

### Get Historical Price
```http
GET /price?token=TOKEN_ADDRESS&network=NETWORK&timestamp=UNIX_TIMESTAMP
```

**Parameters:**
- `token` - Token contract address (e.g., USDC address)
- `network` - Either `ethereum` or `polygon`
- `timestamp` - Unix timestamp for the desired price point

**Example:**
```bash
curl "http://localhost:3000/price?token=0xA0b86a33E6417a6502c6b2dc4b6c6Cc5e2f5f0a8&network=ethereum&timestamp=1640995200"
```

**Response:**
```json
{
  "price": 1.001,
  "source": "interpolated"
}
```

### Schedule Batch Price Fetching
```http
POST /schedule
Content-Type: application/json

{
  "token": "TOKEN_ADDRESS",
  "network": "NETWORK"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/schedule \
  -H "Content-Type: application/json" \
  -d '{"token":"0xA0b86a33E6417a6502c6b2dc4b6c6Cc5e2f5f0a8","network":"ethereum"}'
```

This will schedule background jobs to fetch daily prices from the token's creation date to today. (Couldn't Implement)

## How it Works

1. **Price Requests**: When you request a price, it first checks the Redis cache
2. **Cache Miss**: If not cached, it fetches from Alchemy API with intelligent interpolation
3. **Smart Retry**: Automatically retries failed requests with exponential backoff
4. **Background Jobs**: Uses BullMQ for processing large batch requests
5. **Caching**: Stores results in Redis for lightning-fast subsequent requests



## Project Structure

```
backend/
├── server.js           # Main server file
├── routes/
│   ├── price.js        # Price API endpoint
│   └── schedule.js     # Batch scheduling endpoint
├── lib/
│   ├── alchemy.js      # Alchemy SDK setup
│   ├── redis.js        # Redis connection
│   └── workers/        # Background job workers
└── utils/
    ├── cache.js        # Caching utilities
    ├── interpolate.js  # Price interpolation logic
    └── validation.js   # Request validation
```
