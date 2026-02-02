/**
 * Sync Worker - Hash generation and parallel sync processing
 *
 * Actions:
 * - hashBatch: Batch MD5 hash generation
 * - generateContentHash: Generate content hash for duplicate detection
 * - generateSyncHash: Generate sync hash for backend deduplication
 * - processSyncItem: Process single sync item
 *
 * Performance target: 100-item queue: Sequential → 4-6x parallel speedup
 *
 * @version 1.0.0
 */

/**
 * MD5 Hash Function (inline implementation to avoid importScripts)
 * Based on https://github.com/blueimp/JavaScript-MD5
 * @param {string} string - Input string
 * @returns {string} MD5 hash (32-character hex string)
 */
function md5(string) {
    function rotateLeft(value, shift) {
        return (value << shift) | (value >>> (32 - shift));
    }

    function addUnsigned(x, y) {
        const lsw = (x & 0xFFFF) + (y & 0xFFFF);
        const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xFFFF);
    }

    function f(x, y, z) {
        return (x & y) | ((~x) & z);
    }

    function g(x, y, z) {
        return (x & z) | (y & (~z));
    }

    function h(x, y, z) {
        return x ^ y ^ z;
    }

    function i(x, y, z) {
        return y ^ (x | (~z));
    }

    function ff(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }

    function gg(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }

    function hh(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }

    function ii(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }

    function convertToWordArray(string) {
        const wordArray = [];
        let wordCount;
        for (let i = 0; i < string.length * 8; i += 8) {
            wordArray[i >> 5] |= (string.charCodeAt(i / 8) & 0xFF) << (i % 32);
        }
        return wordArray;
    }

    function utf8Encode(string) {
        string = string.replace(/\r\n/g, "\n");
        let utftext = "";
        for (let n = 0; n < string.length; n++) {
            const c = string.charCodeAt(n);
            if (c < 128) {
                utftext += String.fromCharCode(c);
            } else if ((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            } else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }
        }
        return utftext;
    }

    function wordToHex(lsw, msw) {
        const hexChars = "0123456789abcdef";
        let hex = "";
        for (let i = 0; i <= 3; i++) {
            const byte = (lsw >>> (i * 8)) & 255;
            hex += hexChars.charAt((byte >>> 4) & 0x0F) + hexChars.charAt(byte & 0x0F);
        }
        return hex;
    }

    let x = [];
    let k, AA, BB, CC, DD, a, b, c, d;
    const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
    const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
    const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
    const S41 = 6, S42 = 10, S43 = 15, S44 = 21;

    string = utf8Encode(string);
    x = convertToWordArray(string);

    a = 0x67452301;
    b = 0xEFCDAB89;
    c = 0x98BADCFE;
    d = 0x10325476;

    const xl = x.length;
    for (k = 0; k < xl; k += 16) {
        AA = a;
        BB = b;
        CC = c;
        DD = d;

        a = ff(a, b, c, d, x[k + 0], S11, 0xD76AA478);
        d = ff(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
        c = ff(c, d, a, b, x[k + 2], S13, 0x242070DB);
        b = ff(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
        a = ff(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
        d = ff(d, a, b, c, x[k + 5], S12, 0x4787C62A);
        c = ff(c, d, a, b, x[k + 6], S13, 0xA8304613);
        b = ff(b, c, d, a, x[k + 7], S14, 0xFD469501);
        a = ff(a, b, c, d, x[k + 8], S11, 0x698098D8);
        d = ff(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
        c = ff(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
        b = ff(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
        a = ff(a, b, c, d, x[k + 12], S11, 0x6B901122);
        d = ff(d, a, b, c, x[k + 13], S12, 0xFD987193);
        c = ff(c, d, a, b, x[k + 14], S13, 0xA679438E);
        b = ff(b, c, d, a, x[k + 15], S14, 0x49B40821);

        a = gg(a, b, c, d, x[k + 1], S21, 0xF61E2562);
        d = gg(d, a, b, c, x[k + 6], S22, 0xC040B340);
        c = gg(c, d, a, b, x[k + 11], S23, 0x265E5A51);
        b = gg(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
        a = gg(a, b, c, d, x[k + 5], S21, 0xD62F105D);
        d = gg(d, a, b, c, x[k + 10], S22, 0x2441453);
        c = gg(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
        b = gg(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
        a = gg(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
        d = gg(d, a, b, c, x[k + 14], S22, 0xC33707D6);
        c = gg(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
        b = gg(b, c, d, a, x[k + 8], S24, 0x455A14ED);
        a = gg(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
        d = gg(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
        c = gg(c, d, a, b, x[k + 7], S23, 0x676F02D9);
        b = gg(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);

        a = hh(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
        d = hh(d, a, b, c, x[k + 8], S32, 0x8771F681);
        c = hh(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
        b = hh(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
        a = hh(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
        d = hh(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
        c = hh(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
        b = hh(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
        a = hh(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
        d = hh(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
        c = hh(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
        b = hh(b, c, d, a, x[k + 6], S34, 0x4881D05);
        a = hh(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
        d = hh(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
        c = hh(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
        b = hh(b, c, d, a, x[k + 2], S34, 0xC4AC5665);

        a = ii(a, b, c, d, x[k + 0], S41, 0xF4292244);
        d = ii(d, a, b, c, x[k + 7], S42, 0x432AFF97);
        c = ii(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
        b = ii(b, c, d, a, x[k + 5], S44, 0xFC93A039);
        a = ii(a, b, c, d, x[k + 12], S41, 0x655B59C3);
        d = ii(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
        c = ii(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
        b = ii(b, c, d, a, x[k + 1], S44, 0x85845DD1);
        a = ii(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
        d = ii(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
        c = ii(c, d, a, b, x[k + 6], S43, 0xA3014314);
        b = ii(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
        a = ii(a, b, c, d, x[k + 4], S41, 0xF7537E82);
        d = ii(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
        c = ii(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
        b = ii(b, c, d, a, x[k + 9], S44, 0xEB86D391);

        a = addUnsigned(a, AA);
        b = addUnsigned(b, BB);
        c = addUnsigned(c, CC);
        d = addUnsigned(d, DD);
    }

    return (wordToHex(a, 0) + wordToHex(b, 0) + wordToHex(c, 0) + wordToHex(d, 0)).toLowerCase();
}

/**
 * Generate content hash for duplicate detection.
 * Format: MD5(article_id|amount|fact_date|description|record_type)
 *
 * @param {Object} data - Fact data
 * @returns {string} Content hash (32-character MD5)
 */
function generateContentHash(data) {
    const parts = [
        String(data.article_id || ''),
        String(data.amount || ''),
        String(data.fact_date || ''),
        String(data.description || ''),
        String(data.record_type || '')
    ];
    const content = parts.join('|');
    return md5(content);
}

/**
 * Generate sync hash for backend deduplication.
 * Format: MD5(content_hash|user_id|created_date)
 *
 * @param {string} contentHash - Content hash
 * @param {number} userId - User ID
 * @param {string} createdDate - Created date (YYYY-MM-DD format)
 * @returns {string} Sync hash (32-character MD5)
 */
function generateSyncHash(contentHash, userId, createdDate) {
    const content = `${contentHash}|${userId}|${createdDate}`;
    return md5(content);
}

/**
 * Batch hash generation for multiple items.
 * O(N) complexity where N = number of items.
 *
 * @param {Array} items - Array of objects with { data, userId, createdDate }
 * @returns {Array} Array of { contentHash, syncHash, index }
 */
function hashBatch(items) {
    const startTime = performance.now();
    const results = [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Generate content hash
        const contentHash = generateContentHash(item.data);

        // Generate sync hash
        const syncHash = generateSyncHash(
            contentHash,
            item.userId,
            item.createdDate
        );

        results.push({
            index: i,
            contentHash,
            syncHash
        });

        // Progress reporting (every 100 items)
        if (i > 0 && i % 100 === 0) {
            self.postMessage({
                type: 'progress',
                message: `Hashed ${i} / ${items.length} items...`
            });
        }
    }

    const duration = Math.round(performance.now() - startTime);

    return {
        results,
        totalItems: items.length,
        duration
    };
}

/**
 * Process single sync item (hash generation + validation).
 *
 * @param {Object} item - Sync item with { data, userId, createdDate }
 * @returns {Object} { contentHash, syncHash, valid, errors }
 */
function processSyncItem(item) {
    const errors = [];

    // Validate required fields
    if (!item.data) {
        errors.push('Missing data field');
    }
    if (!item.userId) {
        errors.push('Missing userId field');
    }
    if (!item.createdDate) {
        errors.push('Missing createdDate field');
    }

    if (errors.length > 0) {
        return {
            contentHash: null,
            syncHash: null,
            valid: false,
            errors
        };
    }

    // Generate hashes
    const contentHash = generateContentHash(item.data);
    const syncHash = generateSyncHash(contentHash, item.userId, item.createdDate);

    return {
        contentHash,
        syncHash,
        valid: true,
        errors: []
    };
}

/**
 * Worker message handler
 */
self.addEventListener('message', (event) => {
    const { id, action, data, options, timestamp } = event.data;
    const startTime = performance.now();

    try {
        let result;

        switch (action) {
            case 'hashBatch':
                result = hashBatch(data.items);
                break;

            case 'generateContentHash':
                result = generateContentHash(data);
                break;

            case 'generateSyncHash':
                result = generateSyncHash(data.contentHash, data.userId, data.createdDate);
                break;

            case 'processSyncItem':
                result = processSyncItem(data.item);
                break;

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        // Send success response
        self.postMessage({
            id,
            success: true,
            result,
            error: null,
            duration: Math.round(performance.now() - startTime),
            timestamp: Date.now()
        });

    } catch (error) {
        // Send error response
        self.postMessage({
            id,
            success: false,
            result: null,
            error: {
                message: error.message,
                code: 'WORKER_ERROR',
                stack: error.stack
            },
            duration: Math.round(performance.now() - startTime),
            timestamp: Date.now()
        });
    }
});

// Worker initialization log (for debugging)
self.postMessage({
    type: 'initialized',
    workerType: 'sync',
    version: '1.0.0',
    timestamp: Date.now()
});
