<script lang="ts">
  import { writable } from 'svelte/store';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { toastStore } from '$stores/toast.store';

  interface FormData {
    name: string;
    email: string;
    age: string;
    phone: string;
    password: string;
    confirmPassword: string;
  }

  interface ValidationErrors {
    name?: string;
    email?: string;
    age?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
  }

  let formData: FormData = {
    name: '',
    email: '',
    age: '',
    phone: '',
    password: '',
    confirmPassword: ''
  };

  let errors: ValidationErrors = {};
  let isSubmitting = false;

  // Validation rules
  function validateForm(): ValidationErrors {
    const newErrors: ValidationErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Имя обязательно для заполнения';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Имя должно содержать минимум 2 символа';
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = 'Email обязателен для заполнения';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Введите корректный email адрес';
    }

    // Age validation
    const age = parseInt(formData.age);
    if (!formData.age.trim()) {
      newErrors.age = 'Возраст обязателен для заполнения';
    } else if (isNaN(age) || age < 1 || age > 120) {
      newErrors.age = 'Введите корректный возраст от 1 до 120 лет';
    }

    // Phone validation (simple Russian format)
    const phoneRegex = /^(\+7|7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/;
    if (!formData.phone.trim()) {
      newErrors.phone = 'Номер телефона обязателен';
    } else if (!phoneRegex.test(formData.phone.replace(/[\s\-\(\)]/g, ''))) {
      newErrors.phone = 'Введите корректный номер телефона';
    }

    // Password validation
    if (!formData.password.trim()) {
      newErrors.password = 'Пароль обязателен для заполнения';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Пароль должен содержать минимум 6 символов';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Пароль должен содержать строчные и заглавные буквы, цифры';
    }

    // Confirm password validation
    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = 'Подтверждение пароля обязательно';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Пароли не совпадают';
    }

    return newErrors;
  }

  function handleInput(field: keyof FormData) {
    return (e: Event) => {
      const target = e.target as HTMLInputElement;
      formData[field] = target.value;
      
      // Clear error for this field when user starts typing
      if (errors[field]) {
        delete errors[field];
        errors = { ...errors };
      }
    };
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    
    isSubmitting = true;
    errors = validateForm();

    if (Object.keys(errors).length === 0) {
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        toastStore.addToast({
          type: 'success',
          title: 'Успех!',
          message: 'Форма успешно отправлена. Все валидации прошли.',
          duration: 5000
        });

        // Reset form
        formData = {
          name: '',
          email: '',
          age: '',
          phone: '',
          password: '',
          confirmPassword: ''
        };
      } catch (error) {
        toastStore.addToast({
          type: 'error',
          title: 'Ошибка',
          message: 'Произошла ошибка при отправке формы',
          duration: 5000
        });
      }
    } else {
      toastStore.addToast({
        type: 'error',
        title: 'Ошибка валидации',
        message: 'Пожалуйста, исправьте ошибки в форме',
        duration: 5000
      });
    }

    isSubmitting = false;
  }

  function resetForm() {
    formData = {
      name: '',
      email: '',
      age: '',
      phone: '',
      password: '',
      confirmPassword: ''
    };
    errors = {};
  }
</script>

<svelte:head>
  <title>Валидация форм - Family Budget</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
  <div class="max-w-2xl mx-auto">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-4">
        Демонстрация валидации форм
      </h1>
      <p class="text-lg text-gray-600">
        Пример комплексной валидации с различными правилами и обработкой ошибок
      </p>
    </div>

    <Card class="p-8" bordered={true}>
      <form on:submit={handleSubmit} class="space-y-6">
        <!-- Name Field -->
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 mb-2">
            Полное имя *
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            on:input={handleInput('name')}
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            class:border-red-500={errors.name}
            placeholder="Введите ваше полное имя"
          />
          {#if errors.name}
            <p class="mt-1 text-sm text-red-600">{errors.name}</p>
          {/if}
        </div>

        <!-- Email Field -->
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
            Email адрес *
          </label>
          <input
            type="email"
            id="email"
            value={formData.email}
            on:input={handleInput('email')}
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            class:border-red-500={errors.email}
            placeholder="example@domain.com"
          />
          {#if errors.email}
            <p class="mt-1 text-sm text-red-600">{errors.email}</p>
          {/if}
        </div>

        <!-- Age Field -->
        <div>
          <label for="age" class="block text-sm font-medium text-gray-700 mb-2">
            Возраст *
          </label>
          <input
            type="number"
            id="age"
            value={formData.age}
            on:input={handleInput('age')}
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            class:border-red-500={errors.age}
            placeholder="Ваш возраст"
            min="1"
            max="120"
          />
          {#if errors.age}
            <p class="mt-1 text-sm text-red-600">{errors.age}</p>
          {/if}
        </div>

        <!-- Phone Field -->
        <div>
          <label for="phone" class="block text-sm font-medium text-gray-700 mb-2">
            Номер телефона *
          </label>
          <input
            type="tel"
            id="phone"
            value={formData.phone}
            on:input={handleInput('phone')}
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            class:border-red-500={errors.phone}
            placeholder="+7 (999) 999-99-99"
          />
          {#if errors.phone}
            <p class="mt-1 text-sm text-red-600">{errors.phone}</p>
          {/if}
        </div>

        <!-- Password Field -->
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
            Пароль *
          </label>
          <input
            type="password"
            id="password"
            value={formData.password}
            on:input={handleInput('password')}
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            class:border-red-500={errors.password}
            placeholder="Минимум 6 символов"
          />
          {#if errors.password}
            <p class="mt-1 text-sm text-red-600">{errors.password}</p>
          {/if}
          <p class="mt-1 text-sm text-gray-500">
            Должен содержать заглавные и строчные буквы, цифры
          </p>
        </div>

        <!-- Confirm Password Field -->
        <div>
          <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-2">
            Подтверждение пароля *
          </label>
          <input
            type="password"
            id="confirmPassword"
            value={formData.confirmPassword}
            on:input={handleInput('confirmPassword')}
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            class:border-red-500={errors.confirmPassword}
            placeholder="Повторите пароль"
          />
          {#if errors.confirmPassword}
            <p class="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
          {/if}
        </div>

        <!-- Submit Buttons -->
        <div class="flex space-x-4 pt-4">
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            class="flex-1"
          >
            {#if isSubmitting}
              <div class="flex items-center justify-center">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Отправка...
              </div>
            {:else}
              Отправить форму
            {/if}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onclick={resetForm}
            disabled={isSubmitting}
          >
            Очистить
          </Button>
        </div>

        <!-- Validation Rules Info -->
        <div class="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 class="text-lg font-medium text-blue-900 mb-3">
            Правила валидации:
          </h3>
          <ul class="text-sm text-blue-800 space-y-1">
            <li>• <strong>Имя:</strong> минимум 2 символа</li>
            <li>• <strong>Email:</strong> корректный формат email адреса</li>
            <li>• <strong>Возраст:</strong> число от 1 до 120</li>
            <li>• <strong>Телефон:</strong> российский формат номера</li>
            <li>• <strong>Пароль:</strong> минимум 6 символов, заглавные и строчные буквы, цифры</li>
            <li>• <strong>Подтверждение:</strong> должно совпадать с паролем</li>
          </ul>
        </div>

        {#if Object.keys(errors).length > 0}
          <div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 class="text-sm font-medium text-red-800 mb-2">
              Ошибки валидации ({Object.keys(errors).length}):
            </h3>
            <ul class="text-sm text-red-700 space-y-1">
              {#each Object.entries(errors) as [field, error]}
                <li>• {error}</li>
              {/each}
            </ul>
          </div>
        {/if}
      </form>
    </Card>

    <!-- Navigation -->
    <div class="mt-8 text-center">
      <a
        href="/"
        class="text-blue-600 hover:text-blue-800 transition-colors font-medium"
      >
        ← Вернуться на главную
      </a>
    </div>
  </div>
</div>

<style>
  .animate-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>