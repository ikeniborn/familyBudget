import React, { useState } from 'react';
import { Layout } from '../../components/common/Layout';
import { Card } from '../../components/common/Card';
import { ValidatedForm } from '../../components/common/form/ValidatedForm';
import { Button } from '../../components/common/form/Button';
import { CheckCircle, AlertCircle, Code, FileText } from 'lucide-react';

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

const FormValidationPage: React.FC = () => {
  const [submittedData, setSubmittedData] = useState<FormInputs | null>(null);
  const [showFormCode, setShowFormCode] = useState(false);

  const handleFormSubmit = (data: FormInputs) => {
    setSubmittedData(data);
    console.log('Form submitted:', data);
  };

  const validationFeatures = [
    {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      title: 'Email валидация',
      description: 'Проверка корректности формата email адреса'
    },
    {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      title: 'Пароль с требованиями',
      description: 'Минимум 8 символов, заглавные/строчные буквы, цифры, спецсимволы'
    },
    {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      title: 'Подтверждение пароля',
      description: 'Проверка совпадения паролей'
    },
    {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      title: 'Возрастные ограничения',
      description: 'Проверка минимального и максимального возраста'
    },
    {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      title: 'Телефон',
      description: 'Валидация формата номера телефона'
    },
    {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      title: 'URL валидация',
      description: 'Проверка корректности веб-адреса'
    },
    {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      title: 'Дата рождения',
      description: 'Проверка логичности даты и соответствия возрасту'
    },
    {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      title: 'Условная логика',
      description: 'Поля зависят друг от друга (город от страны)'
    },
    {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      title: 'Обязательные поля',
      description: 'Четкое разделение обязательных и опциональных полей'
    }
  ];

  const technicalFeatures = [
    {
      icon: <Code className="h-5 w-5 text-blue-500" />,
      title: 'React Hook Form',
      description: 'Производительная библиотека для работы с формами'
    },
    {
      icon: <Code className="h-5 w-5 text-blue-500" />,
      title: 'Yup Schema',
      description: 'Декларативная схема валидации с поддержкой TypeScript'
    },
    {
      icon: <AlertCircle className="h-5 w-5 text-orange-500" />,
      title: 'Валидация onChange',
      description: 'Мгновенная обратная связь при вводе'
    },
    {
      icon: <AlertCircle className="h-5 w-5 text-orange-500" />,
      title: 'Статусы формы',
      description: 'isDirty, isValid, isSubmitting для UX'
    },
    {
      icon: <FileText className="h-5 w-5 text-purple-500" />,
      title: 'TypeScript',
      description: 'Полная типизация данных формы'
    },
    {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      title: 'Accessibility',
      description: 'Поддержка ARIA и клавиатурной навигации'
    }
  ];

  const formExampleCode = `
// Пример использования ValidatedForm
import { ValidatedForm } from './components/common/form/ValidatedForm';

const MyComponent = () => {
  const handleSubmit = (data) => {
    console.log('Form data:', data);
  };

  return (
    <ValidatedForm
      title="Регистрация"
      onSubmit={handleSubmit}
      initialData={{ country: 'RU' }}
    />
  );
};

// Схема валидации (Yup)
const schema = yup.object({
  email: yup.string()
    .required('Email обязателен')
    .email('Некорректный формат'),
  password: yup.string()
    .required('Пароль обязателен')
    .min(8, 'Минимум 8 символов')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)/, 'Требования к паролю'),
  age: yup.number()
    .required('Возраст обязателен')
    .min(18, 'Минимум 18 лет')
    .max(120, 'Максимум 120 лет')
});
`;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Форма с валидацией
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Демонстрация возможностей React Hook Form + Yup
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowFormCode(!showFormCode)}
            >
              <Code className="h-4 w-4 mr-1" />
              {showFormCode ? 'Скрыть код' : 'Показать код'}
            </Button>
          </div>
        </div>

        {/* Features Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Validation Features */}
          <Card title="Функции валидации">
            <div className="space-y-3">
              {validationFeatures.map((feature, index) => (
                <div key={index} className="flex items-start gap-3">
                  {feature.icon}
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      {feature.title}
                    </div>
                    <div className="text-xs text-gray-600">
                      {feature.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Technical Features */}
          <Card title="Технические особенности">
            <div className="space-y-3">
              {technicalFeatures.map((feature, index) => (
                <div key={index} className="flex items-start gap-3">
                  {feature.icon}
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      {feature.title}
                    </div>
                    <div className="text-xs text-gray-600">
                      {feature.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Code Example */}
        {showFormCode && (
          <Card title="Пример использования">
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
              <code>{formExampleCode}</code>
            </pre>
          </Card>
        )}

        {/* Main Form */}
        <ValidatedForm
          title="Форма регистрации с полной валидацией"
          onSubmit={handleFormSubmit}
        />

        {/* Submitted Data Display */}
        {submittedData && (
          <Card title="Отправленные данные" className="bg-green-50 border-green-200">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Форма успешно отправлена!</span>
              </div>
              
              <div className="bg-white p-4 rounded-lg border">
                <h4 className="font-medium text-gray-900 mb-3">Данные формы:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Личная информация:</strong>
                    <ul className="mt-1 space-y-1 text-gray-600">
                      <li>Имя: {submittedData.firstName}</li>
                      <li>Фамилия: {submittedData.lastName}</li>
                      <li>Возраст: {submittedData.age}</li>
                      <li>Дата рождения: {submittedData.birthDate?.toLocaleDateString('ru-RU')}</li>
                    </ul>
                  </div>
                  
                  <div>
                    <strong>Контакты:</strong>
                    <ul className="mt-1 space-y-1 text-gray-600">
                      <li>Email: {submittedData.email}</li>
                      <li>Телефон: {submittedData.phone}</li>
                      <li>Страна: {submittedData.country}</li>
                      <li>Город: {submittedData.city}</li>
                      {submittedData.website && <li>Сайт: {submittedData.website}</li>}
                    </ul>
                  </div>
                  
                  <div>
                    <strong>Профессиональное:</strong>
                    <ul className="mt-1 space-y-1 text-gray-600">
                      <li>Категория: {submittedData.category}</li>
                      {submittedData.salary && <li>Зарплата: {submittedData.salary.toLocaleString('ru-RU')} ₽</li>}
                    </ul>
                  </div>
                  
                  <div>
                    <strong>Согласия:</strong>
                    <ul className="mt-1 space-y-1 text-gray-600">
                      <li>Условия: {submittedData.agreement ? 'Принято' : 'Не принято'}</li>
                      <li>Рассылка: {submittedData.newsletter ? 'Подписан' : 'Не подписан'}</li>
                    </ul>
                  </div>
                </div>
                
                {submittedData.bio && (
                  <div className="mt-4">
                    <strong>О себе:</strong>
                    <p className="mt-1 text-gray-600 text-sm italic">{submittedData.bio}</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Test Scenarios */}
        <Card title="Сценарии для тестирования">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Попробуйте следующие сценарии для проверки валидации:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">❌ Невалидные данные:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Email без @ или домена</li>
                  <li>• Пароль короче 8 символов</li>
                  <li>• Разные пароли в подтверждении</li>
                  <li>• Возраст менее 18 или более 120</li>
                  <li>• Некорректный номер телефона</li>
                  <li>• Неправильный URL формат</li>
                  <li>• Дата рождения в будущем</li>
                  <li>• Попытка отправки без согласия</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">✅ Валидные данные:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Используйте кнопку "Заполнить тестовыми данными"</li>
                  <li>• Email: test@example.com</li>
                  <li>• Пароль: TestPass123!</li>
                  <li>• Возраст: 25</li>
                  <li>• Телефон: +79123456789</li>
                  <li>• URL: https://example.com</li>
                  <li>• Обязательно согласие с условиями</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default FormValidationPage;