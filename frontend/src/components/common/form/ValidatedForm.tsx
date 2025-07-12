import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Card } from '../Card';
import { Input } from './Input';
import { Select } from './Select';
import { TextArea } from './TextArea';
import { DatePicker } from './DatePicker';
import { Button } from './Button';
import { useToast } from '../ToastContainer';

interface FormInputs {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  age: number;
  country: string;
  city: string;
  phone: string;
  birthDate: Date;
  website?: string;
  bio?: string;
  agreement: boolean;
  newsletter: boolean;
  category: string;
  salary?: number;
}

// Validation schema using Yup
const validationSchema = yup.object({
  email: yup
    .string()
    .required('Email обязателен')
    .email('Некорректный формат email'),
  password: yup
    .string()
    .required('Пароль обязателен')
    .min(8, 'Пароль должен содержать минимум 8 символов')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Пароль должен содержать заглавные и строчные буквы, цифры и спецсимволы'
    ),
  confirmPassword: yup
    .string()
    .required('Подтверждение пароля обязательно')
    .oneOf([yup.ref('password')], 'Пароли должны совпадать'),
  firstName: yup
    .string()
    .required('Имя обязательно')
    .min(2, 'Имя должно содержать минимум 2 символа')
    .max(50, 'Имя не должно превышать 50 символов'),
  lastName: yup
    .string()
    .required('Фамилия обязательна')
    .min(2, 'Фамилия должна содержать минимум 2 символа')
    .max(50, 'Фамилия не должна превышать 50 символов'),
  age: yup
    .number()
    .required('Возраст обязателен')
    .min(18, 'Возраст должен быть не менее 18 лет')
    .max(120, 'Возраст не может превышать 120 лет')
    .typeError('Возраст должен быть числом'),
  country: yup
    .string()
    .required('Выберите страну'),
  city: yup
    .string()
    .required('Город обязателен')
    .min(2, 'Название города должно содержать минимум 2 символа'),
  phone: yup
    .string()
    .required('Телефон обязателен')
    .matches(
      /^[\+]?[1-9][\d]{0,15}$/,
      'Некорректный формат телефона'
    ),
  birthDate: yup
    .date()
    .required('Дата рождения обязательна')
    .max(new Date(), 'Дата рождения не может быть в будущем')
    .test('age', 'Возраст должен быть не менее 18 лет', function(value) {
      if (!value) return false;
      const today = new Date();
      const eighteenYearsAgo = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
      return value <= eighteenYearsAgo;
    }),
  website: yup
    .string()
    .url('Некорректный URL')
    .optional(),
  bio: yup
    .string()
    .max(500, 'Биография не должна превышать 500 символов'),
  agreement: yup
    .boolean()
    .oneOf([true], 'Необходимо согласиться с условиями'),
  newsletter: yup
    .boolean(),
  category: yup
    .string()
    .required('Выберите категорию'),
  salary: yup
    .number()
    .min(0, 'Зарплата не может быть отрицательной')
    .typeError('Зарплата должна быть числом')
    .optional(),
});

interface ValidatedFormProps {
  onSubmit?: (data: FormInputs) => void;
  initialData?: Partial<FormInputs>;
  title?: string;
}

const countryOptions = [
  { value: '', label: 'Выберите страну' },
  { value: 'RU', label: 'Россия' },
  { value: 'US', label: 'США' },
  { value: 'DE', label: 'Германия' },
  { value: 'FR', label: 'Франция' },
  { value: 'GB', label: 'Великобритания' },
  { value: 'JP', label: 'Япония' },
  { value: 'CN', label: 'Китай' },
];

const categoryOptions = [
  { value: '', label: 'Выберите категорию' },
  { value: 'developer', label: 'Разработчик' },
  { value: 'designer', label: 'Дизайнер' },
  { value: 'manager', label: 'Менеджер' },
  { value: 'analyst', label: 'Аналитик' },
  { value: 'tester', label: 'Тестировщик' },
  { value: 'other', label: 'Другое' },
];

export const ValidatedForm: React.FC<ValidatedFormProps> = ({ 
  onSubmit, 
  initialData = {},
  title = 'Форма с валидацией' 
}) => {
  const toast = useToast();
  
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isDirty, isValid },
    reset,
    watch,
    setValue,
    clearErrors,
  } = useForm({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      age: undefined,
      country: '',
      city: '',
      phone: '',
      birthDate: undefined,
      website: '',
      bio: '',
      agreement: false,
      newsletter: false,
      category: '',
      salary: undefined,
      ...initialData,
    },
    mode: 'onChange', // Validate on change for better UX
  });

  // Watch specific fields for conditional logic
  const watchedCountry = watch('country');
  const watchedAgreement = watch('agreement');

  const onFormSubmit = async (data: any) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Form submitted with data:', data);
      toast.success('Успешно', 'Форма успешно отправлена!');
      
      if (onSubmit) {
        onSubmit(data);
      }
    } catch (error) {
      console.error('Form submission error:', error);
      toast.error('Ошибка', 'Произошла ошибка при отправке формы');
    }
  };

  const handleReset = () => {
    reset();
    clearErrors();
    toast.info('Информация', 'Форма очищена');
  };

  const handleFillTestData = () => {
    setValue('email', 'test@example.com');
    setValue('password', 'TestPass123!');
    setValue('confirmPassword', 'TestPass123!');
    setValue('firstName', 'Иван');
    setValue('lastName', 'Иванов');
    setValue('age', 25);
    setValue('country', 'RU');
    setValue('city', 'Москва');
    setValue('phone', '+79123456789');
    setValue('birthDate', new Date('1999-01-01'));
    setValue('website', 'https://example.com');
    setValue('bio', 'Это тестовая биография пользователя.');
    setValue('agreement', true);
    setValue('newsletter', true);
    setValue('category', 'developer');
    setValue('salary', 150000);
    
    toast.info('Информация', 'Тестовые данные заполнены');
  };

  return (
    <Card title={title} className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        {/* Header with form status */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-medium text-gray-900">
              Статус формы
            </h3>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleFillTestData}
              >
                Заполнить тестовыми данными
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleReset}
                disabled={!isDirty}
              >
                Очистить форму
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className={`p-2 rounded ${isDirty ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>
              Изменена: {isDirty ? 'Да' : 'Нет'}
            </div>
            <div className={`p-2 rounded ${isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              Валидна: {isValid ? 'Да' : 'Нет'}
            </div>
            <div className={`p-2 rounded ${isSubmitting ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
              Отправляется: {isSubmitting ? 'Да' : 'Нет'}
            </div>
          </div>
        </div>

        {/* Personal Information Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
            Личная информация
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Имя"
              {...register('firstName')}
              error={errors.firstName?.message}
              placeholder="Введите ваше имя"
            />
            
            <Input
              label="Фамилия"
              {...register('lastName')}
              error={errors.lastName?.message}
              placeholder="Введите вашу фамилию"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Возраст"
              type="number"
              {...register('age')}
              error={errors.age?.message}
              placeholder="Введите ваш возраст"
            />
            
            <Controller
              name="birthDate"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label="Дата рождения"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.birthDate?.message}
                  placeholder="Выберите дату рождения"
                />
              )}
            />
          </div>
        </div>

        {/* Contact Information Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
            Контактная информация
          </h3>
          
          <Input
            label="Email"
            type="email"
            {...register('email')}
            error={errors.email?.message}
            placeholder="example@email.com"
          />

          <Input
            label="Телефон"
            type="tel"
            {...register('phone')}
            error={errors.phone?.message}
            placeholder="+7 (999) 123-45-67"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Страна"
              options={countryOptions}
              {...register('country')}
              error={errors.country?.message}
            />
            
            <Input
              label="Город"
              {...register('city')}
              error={errors.city?.message}
              placeholder="Введите ваш город"
              disabled={!watchedCountry}
              helperText={!watchedCountry ? 'Сначала выберите страну' : undefined}
            />
          </div>

          <Input
            label="Веб-сайт"
            type="url"
            {...register('website')}
            error={errors.website?.message}
            placeholder="https://your-website.com"
            helperText="Необязательное поле"
          />
        </div>

        {/* Security Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
            Безопасность
          </h3>
          
          <Input
            label="Пароль"
            type="password"
            {...register('password')}
            error={errors.password?.message}
            placeholder="Введите надежный пароль"
            helperText="Минимум 8 символов, включая заглавные/строчные буквы, цифры и спецсимволы"
          />

          <Input
            label="Подтверждение пароля"
            type="password"
            {...register('confirmPassword')}
            error={errors.confirmPassword?.message}
            placeholder="Повторите пароль"
          />
        </div>

        {/* Professional Information Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
            Профессиональная информация
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Категория"
              options={categoryOptions}
              {...register('category')}
              error={errors.category?.message}
            />
            
            <Input
              label="Зарплата (₽)"
              type="number"
              {...register('salary')}
              error={errors.salary?.message}
              placeholder="150000"
              helperText="Необязательное поле"
            />
          </div>

          <TextArea
            label="О себе"
            {...register('bio')}
            error={errors.bio?.message}
            placeholder="Расскажите немного о себе..."
            rows={4}
            helperText="Максимум 500 символов"
          />
        </div>

        {/* Agreements Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
            Согласия
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="agreement"
                {...register('agreement')}
                className={`mt-1 rounded border-gray-300 ${
                  errors.agreement ? 'border-red-500' : ''
                }`}
              />
              <div className="flex-1">
                <label htmlFor="agreement" className="text-sm font-medium text-gray-700">
                  Я согласен с условиями использования и политикой конфиденциальности
                  <span className="text-red-500 ml-1">*</span>
                </label>
                {errors.agreement && (
                  <p className="mt-1 text-sm text-red-600">{errors.agreement.message}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="newsletter"
                {...register('newsletter')}
                className="mt-1 rounded border-gray-300"
              />
              <label htmlFor="newsletter" className="text-sm text-gray-700">
                Я хочу получать новости и обновления по email
              </label>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="border-t pt-6">
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={handleReset}
              disabled={!isDirty || isSubmitting}
            >
              Сбросить
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isSubmitting || !watchedAgreement}
              className="min-w-[200px]"
            >
              {isSubmitting ? 'Отправка...' : 'Отправить форму'}
            </Button>
          </div>
        </div>

        {/* Debug Information (for development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-gray-100 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Debug Information (только в development)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <strong>Errors:</strong>
                <pre className="mt-1 text-red-600 overflow-auto">
                  {Object.keys(errors).length > 0 ? JSON.stringify(errors, null, 2) : 'Нет ошибок'}
                </pre>
              </div>
              <div>
                <strong>Form Values:</strong>
                <pre className="mt-1 text-gray-600 overflow-auto">
                  {JSON.stringify(watch(), null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </form>
    </Card>
  );
};