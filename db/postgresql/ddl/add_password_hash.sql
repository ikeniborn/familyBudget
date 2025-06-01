-- Add password hash column to user table
ALTER TABLE t_d_user 
ADD COLUMN IF NOT EXISTS user_password_hash VARCHAR(255);

-- Comment on new column
COMMENT ON COLUMN t_d_user.user_password_hash IS 'Хэш пароля пользователя для JWT аутентификации';