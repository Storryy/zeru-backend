const redis = require('../lib/redis');

const CACHE_TTL = 300;

const generateCacheKey = (token, network, timestamp) => {
    return `price:${token}:${network}:${timestamp}`;
}

const getCachedPrice = async (token, network, timestamp) => {
    try {
        const key = generateCacheKey(token, network, timestamp);
        const cached = await redis.get(key);
        
        if (cached) {
            console.log('TTL extended back to 300 seconds');
            // Extend TTL on cache hit (sliding expiration)
            await redis.expire(key, CACHE_TTL);
            return JSON.parse(cached);
        }
        
        return null;
    } catch (error) {
        console.error('Redis get error:', error);
        return null;
    }
};

const setCachedPrice = async (token, network, timestamp, priceData) => {
    try {
        const key = generateCacheKey(token, network, timestamp);
        await redis.setEx(key, CACHE_TTL, JSON.stringify(priceData))
    } catch (error) {
        console.error('Redis set error:', error);
    }
};

module.exports = { getCachedPrice, setCachedPrice, generateCacheKey };