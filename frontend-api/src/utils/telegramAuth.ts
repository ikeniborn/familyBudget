import crypto from 'crypto';

interface TelegramAuthData {
  auth_date: string;
  first_name?: string;
  hash: string;
  id: string;
  last_name?: string;
  photo_url?: string;
  username?: string;
}

export function verifyTelegramAuth(authData: TelegramAuthData, botToken: string): boolean {
  const { hash, ...data } = authData;
  
  // Create data check string
  const dataCheckArr = Object.keys(data)
    .sort()
    .map(key => `${key}=${data[key as keyof typeof data]}`)
    .filter(item => item.split('=')[1] !== undefined);
  
  const dataCheckString = dataCheckArr.join('\n');
  
  // Create secret key
  const secretKey = crypto
    .createHash('sha256')
    .update(botToken)
    .digest();
  
  // Calculate hash
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  // Verify hash
  if (calculatedHash !== hash) {
    return false;
  }
  
  // Check auth date (optional - allow auth data up to 24 hours old)
  const authTimestamp = parseInt(authData.auth_date);
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const timeDiff = currentTimestamp - authTimestamp;
  
  if (timeDiff > 86400) { // 24 hours
    return false;
  }
  
  return true;
}