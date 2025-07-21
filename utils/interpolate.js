function interpolatePrice(priceData, requestedTimestamp) {
    const prices = priceData.data;
    const price = prices.map(price => parseFloat(price.value)); // Convert to numbers
    const timestamps = prices.map(price => price.timestamp);

    
    const unixRequestedTimestamp = parseInt(requestedTimestamp, 10);

    // Handle edge cases
    if (price.length === 0) {
        throw new Error('No price data available');
    }
    
    if (price.length === 1) {
        console.log('Single price point available, returning:', price[0]);
        return {
            price: price[0],
            source: 'alchemy'
        };
    }

    // Convert all timestamps to unix timestamps
    const unixTimestamps = timestamps.map(timestamp => 
        parseInt(new Date(timestamp).getTime() / 1000, 10)
    );

    console.log('Unix timestamps:', unixTimestamps);
    console.log('Requested timestamp:', unixRequestedTimestamp);

    // Check if requested timestamp already exists in the data
    const exactMatchIndex = unixTimestamps.findIndex(timestamp => timestamp === unixRequestedTimestamp);
    if (exactMatchIndex !== -1) {
        console.log('Exact timestamp match found in original data, returning:', price[exactMatchIndex]);
        return {
            price: price[exactMatchIndex],
            source: 'alchemy'
        };
    }

    // Sort the data by timestamp to ensure chronological order
    const sortedData = unixTimestamps.map((timestamp, index) => ({
        timestamp,
        price: price[index]
    })).sort((a, b) => a.timestamp - b.timestamp);

    const sortedTimestamps = sortedData.map(item => item.timestamp);
    const sortedPrices = sortedData.map(item => item.price);

    console.log('Sorted timestamps:', sortedTimestamps);
    console.log('Sorted prices:', sortedPrices);

    // Find the two closest timestamps for interpolation
    let beforeIndex = -1;
    let afterIndex = -1;

    // Find the closest timestamp before or equal to requested time
    for (let i = 0; i < sortedTimestamps.length; i++) {
        if (sortedTimestamps[i] <= unixRequestedTimestamp) {
            beforeIndex = i;
        } else {
            afterIndex = i;
            break;
        }
    }

    // Handle edge cases where requested time is outside the range
    if (beforeIndex === -1) {
        // Requested time is before all available data
        console.log('Requested time is before all data, returning earliest price:', sortedPrices[0]);
        return {
            price: sortedPrices[0],
            source: 'alchemy'
        };
    }
    
    if (afterIndex === -1) {
        // Requested time is after all available data
        console.log('Requested time is after all data, returning latest price:', sortedPrices[sortedPrices.length - 1]);
        return {
            price: sortedPrices[sortedPrices.length - 1],
            source: 'alchemy'
        };
    }

    // If requested time exactly matches a timestamp, return that price
    if (sortedTimestamps[beforeIndex] === unixRequestedTimestamp) {
        console.log('Exact timestamp match found, returning price:', sortedPrices[beforeIndex]);
        return {
            price: sortedPrices[beforeIndex],
            source: 'alchemy'
        };
    }

    // Perform linear interpolation between the two closest points
    const beforePrice = sortedPrices[beforeIndex];
    const afterPrice = sortedPrices[afterIndex];
    const unixBeforeTimestamp = sortedTimestamps[beforeIndex];
    const unixAfterTimestamp = sortedTimestamps[afterIndex];

    const ratio = (unixRequestedTimestamp - unixBeforeTimestamp) / (unixAfterTimestamp - unixBeforeTimestamp);
    const interpolatedPrice = beforePrice + (afterPrice - beforePrice) * ratio;

    console.log('Interpolating between:', {
        beforeTime: unixBeforeTimestamp,
        afterTime: unixAfterTimestamp,
        beforePrice,
        afterPrice,
        ratio,
        interpolatedPrice
    });

    return {
        price: interpolatedPrice,
        source: 'interpolated'
    };
}

module.exports = { interpolatePrice }