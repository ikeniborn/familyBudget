# Component System Architecture

**Version:** 1.3.0 (Phase 4: Modal System)
**Bundle Size:** 65KB minified, ~18KB gzipped
**Components:** 19 (7 Base + 5 Composite + 4 Forms + 3 Modals)
**Code Reduction:** ~2,000 lines saved through reusability
**Created:** Phase 4 implementation (v7.x)

---

## Overview

Family Budget PWA компонентная система - это библиотека переиспользуемых TypeScript компонентов для построения форм, модальных окон и UI элементов. Система использует **Hybrid Architecture** подход: серверный рендеринг (Jinja2) для первого загрузки + клиентские компоненты (TypeScript) для интерактивности.

### Key Features

- ✅ **80%+ Reusability** - Компоненты переиспользуются в 8+ местах
- ✅ **Type Safety** - Полная типизация TypeScript с generics
- ✅ **Zero Refactoring** - Существующие виджеты обернуты без модификаций
- ✅ **Offline Support** - Работает с offlineManager и IndexedDB
- ✅ **DaisyUI Integration** - Единый стиль с существующими страницами
- ✅ **Tree-Shaking** - Rollup оптимизация для минимального bundle size

### Architecture Decision

| Подход | Pros | Cons | Score |
|--------|------|------|-------|
| HTMX Templates | ✅ Совместимость<br>✅ Zero bundle | ❌ Нет offline<br>❌ Не переиспользует виджеты | 6/10 |
| TypeScript Classes | ✅ Offline support<br>✅ Type safety | ❌ Breaking HTMX<br>❌ Large bundle | 7/10 |
| Web Components | ✅ Framework-agnostic | ❌ DaisyUI conflicts<br>❌ iOS Safari issues | 5/10 |
| **Hybrid** ⭐ | ✅ Все преимущества | ⚠️ Dual maintenance | **9/10** |

**Hybrid = Jinja2 первый рендер + TypeScript компоненты для интерактивности**

---

## Component Hierarchy

```
UIComponents (65KB minified)
│
├── Base Components (Core Primitives)
│   ├── FormField          - Universal wrapper с label/error/hint
│   ├── TextInput          - Simple text input
│   ├── TextareaInput      - Multi-line text
│   ├── AmountInput        - Validated number input
│   ├── SelectDropdown     - Basic dropdown
│   ├── DateInput          - Wraps CalendarWidget (ZERO refactoring)
│   └── HierarchySelect<T> - Generic tree select (wraps ChoicesCategoryTree)
│
├── Composite Components (Business Logic)
│   ├── FinancialCenterSelect  - Account picker с API
│   ├── ArticleSelect          - Category tree с фильтрацией
│   ├── CostCenterSelect       - Cost center dropdown
│   ├── RecurringPlanSettings  - Recurring payment UI (MMDD encoding)
│   └── ReminderSettings       - Reminder configuration
│
├── Form Components (Complete Forms)
│   ├── TransactionForm        - Transaction creation (555 lines)
│   ├── TransferForm           - Money transfer (445 lines)
│   ├── RecurringPlanForm      - Recurring plans (483 lines)
│   └── AdminCrudForm<T>       - Generic CRUD (saves ~1,200 lines!)
│
└── Modal Components (Modal Management)
    ├── BaseModal              - DaisyUI dialog wrapper
    ├── FormModal              - BaseModal + validation
    └── CrudModal<T>           - FormModal + CRUD operations
```

---

## Core Design Patterns

### 1. Wrapper Pattern (ZERO Refactoring)

Существующие виджеты (CalendarWidget 969 строк, ChoicesCategoryTree 1337 строк) обернуты без модификаций.

**Example: DateInput wraps CalendarWidget**

```typescript
// modules/uiComponents/core/DateInput.ts
import { CalendarWidget } from '@shared/budgetShared';

export class DateInput {
  private calendar: CalendarWidget;

  constructor(private props: DateInputProps) {
    this.render();

    // Reuse existing CalendarWidget (ZERO modifications)
    this.calendar = new CalendarWidget({
      inputElement: this.input,
      mode: this.props.mode || 'single',
      onDateSelect: (date) => {
        this.props.onChange?.(date);
      }
    });
  }

  getValue(): string | [string, string] {
    return this.calendar.getSelectedDate();
  }

  setValue(value: string | [string, string]): void {
    this.calendar.setDate(value);
  }
}
```

**Benefits:**
- ✅ CalendarWidget остается неизменным (969 строк не тронуты)
- ✅ 100% переиспользование существующей функциональности
- ✅ Добавлены quick date buttons (Today, Yesterday)
- ✅ Интеграция с FormField wrapper

**Example: HierarchySelect<T> wraps ChoicesCategoryTree**

```typescript
// modules/uiComponents/core/HierarchySelect.ts
import { ChoicesCategoryTree } from '@shared/budgetShared';

export class HierarchySelect<T extends Article | ProductGroup> {
  private choicesInstance: ChoicesCategoryTree | null = null;

  private initHierarchyWidget(): void {
    if (this.props.type === 'category') {
      this.choicesInstance = new ChoicesCategoryTree(
        `#${this.props.name}`,
        {
          type: this.props.articleType,
          financialCenterId: this.props.financialCenterId,
          onChange: (category) => {
            this.props.onChange?.(category as T);
          }
        }
      );
    }
  }

  // Delegate methods to wrapped instance
  updateType(type: 'expense' | 'income'): void {
    if (this.choicesInstance && 'updateType' in this.choicesInstance) {
      this.choicesInstance.updateType(type);
    }
  }
}
```

**Benefits:**
- ✅ ChoicesCategoryTree остается неизменным (1337 строк не тронуты)
- ✅ Generic typing для Article | ProductGroup
- ✅ Delegation pattern для updateType, updateFinancialCenter
- ✅ Интеграция с FormField wrapper

---

### 2. Generic Types for Reusability

**AdminCrudForm<T>** - Generic CRUD form (highest ROI: saves ~1,200 lines)

```typescript
// modules/uiComponents/forms/AdminCrudForm.ts
export interface FieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'multi-select' | 'checkbox';
  options?: SelectOption[];
  asyncOptions?: () => Promise<SelectOption[]>;
  required?: boolean;
  validation?: (value: any) => ValidationResult;
  helpText?: string;
}

export class AdminCrudForm<T> {
  constructor(private props: AdminCrudFormProps<T>) {
    this.render();
  }

  collectFormData(): T {
    const data: any = {};
    this.fields.forEach(({ component, definition }) => {
      if (definition.type === 'checkbox') {
        // Handle checkbox
        const checkbox = (component as HTMLDivElement).querySelector('input[type="checkbox"]') as HTMLInputElement | null;
        data[definition.name] = checkbox?.checked || false;
      } else {
        // Handle other types
        data[definition.name] = (component as any).getValue();
      }
    });
    return data as T;
  }
}
```

**Usage Example:**

```typescript
// Admin Articles CRUD
interface Article {
  id?: number;
  name: string;
  type: 'expense' | 'income';
  is_active: boolean;
}

const form = new AdminCrudForm<Article>({
  entity: 'article',
  mode: 'create',
  fields: [
    { name: 'name', label: 'Название', type: 'text', required: true },
    { name: 'type', label: 'Тип', type: 'select', required: true,
      options: [
        { value: 'expense', label: 'Расход' },
        { value: 'income', label: 'Доход' }
      ]
    },
    { name: 'is_active', label: 'Активна', type: 'checkbox' }
  ],
  onSubmit: async (data) => {
    await fetch('/api/v1/articles', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
});
```

**Benefits:**
- ✅ Saves ~1,200 lines across admin panels
- ✅ Type-safe form data collection
- ✅ Async options loading
- ✅ 6 field types supported

---

### 3. Composition over Inheritance

Components используют композицию для объединения функциональности.

**Example: TransactionForm composes multiple components**

```typescript
// modules/uiComponents/forms/TransactionForm.ts
export class TransactionForm {
  private dateInput: DateInput;
  private amountInput: AmountInput;
  private financialCenterSelect: FinancialCenterSelect;
  private articleSelect: ArticleSelect;
  private costCenterSelect: CostCenterSelect;
  private commentInput: TextareaInput;

  constructor(private props: TransactionFormProps) {
    this.initializeComponents();
  }

  private initializeComponents(): void {
    this.dateInput = new DateInput({
      name: 'fact_date',
      label: 'Дата',
      required: true,
      mode: 'single'
    });

    this.amountInput = new AmountInput({
      name: 'amount',
      label: 'Сумма',
      required: true,
      min: 1,
      step: 1
    });

    this.financialCenterSelect = new FinancialCenterSelect({
      name: 'financial_center_id',
      label: 'Счет',
      required: true,
      onChange: () => this.updateArticleFilter()
    });

    this.articleSelect = new ArticleSelect({
      name: 'article_id',
      label: 'Статья',
      required: true,
      articleType: 'expense',
      onChange: () => this.updateFactHints()
    });
  }

  collectFormData(): TransactionData {
    return {
      fact_date: this.dateInput.getValue() as string,
      amount: this.amountInput.getValue(),
      financial_center_id: this.financialCenterSelect.getValue(),
      article_id: this.articleSelect.getValue(),
      cost_center_id: this.costCenterSelect.getValue() || null,
      comment: this.commentInput.getValue() || ''
    };
  }
}
```

**Benefits:**
- ✅ Clear separation of concerns
- ✅ Easy to test individual components
- ✅ Flexible form composition
- ✅ Type-safe data collection

---

### 4. Modal Lifecycle Management

**BaseModal → FormModal → CrudModal** (delegation pattern)

```typescript
// modules/uiComponents/modals/CrudModal.ts
export class CrudModal<T extends { id?: number | string }> {
  private formModal: FormModal | null = null;
  private currentMode: 'create' | 'edit' = 'create';

  async openForCreate(): Promise<void> {
    this.currentMode = 'create';
    this.currentData = null;
    await this.setupModal();
    this.formModal!.open();
  }

  async openForEdit(data: T): Promise<void> {
    this.currentMode = 'edit';
    this.currentData = data;
    await this.setupModal();
    this.formModal!.open();
  }

  private async setupModal(): Promise<void> {
    // Create form using formBuilder
    this.currentForm = this.props.formBuilder(this.currentMode, this.currentData || undefined);

    // Create FormModal
    this.formModal = new FormModal({
      id: this.props.id,
      title: this.currentMode === 'create' ? this.props.createTitle : this.props.editTitle,
      formContent: formContainer,
      submitLabel: this.currentMode === 'create' ? '✅ Создать' : '💾 Обновить',
      onValidate: () => this.handleValidate(),
      onSubmit: () => this.handleSubmit(),
      onSuccess: () => this.handleSuccess()
    });

    // Add delete button for edit mode
    if (this.currentMode === 'edit' && this.props.onDelete) {
      this.addDeleteButton();
    }
  }

  private async handleSubmit(): Promise<void> {
    const data = this.currentForm.collectFormData();

    if (this.currentMode === 'create') {
      await this.props.onCreate(data);
    } else {
      await this.props.onUpdate(this.currentData!.id!, data);
    }
  }
}
```

**Usage Example:**

```typescript
const modal = new CrudModal<Article>({
  id: 'article-modal',
  entity: 'article',
  createTitle: 'Создать статью',
  editTitle: 'Редактировать статью',
  formBuilder: (mode, data) => {
    return new AdminCrudForm<Article>({
      entity: 'article',
      mode: mode,
      fields: [...],
      initialData: data
    });
  },
  onCreate: async (data) => {
    const response = await fetch('/api/v1/articles', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.json();
  },
  onUpdate: async (id, data) => {
    const response = await fetch(`/api/v1/articles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return response.json();
  },
  onDelete: async (id) => {
    await fetch(`/api/v1/articles/${id}`, { method: 'DELETE' });
  },
  onSuccess: () => {
    reloadTable();
  }
});

// Open for create
modal.openForCreate();

// Open for edit
modal.openForEdit({ id: 123, name: 'Продукты', type: 'expense' });
```

**Benefits:**
- ✅ Consistent modal lifecycle (open → validate → submit → close)
- ✅ Dynamic mode switching (create/edit)
- ✅ Delete confirmation built-in
- ✅ Loading states + error handling

---

## Integration with Existing Code

### 1. HTMX Compatibility (No Conflicts)

**Separation of Concerns:**
- HTMX: Dashboard widgets (server-side rendering)
- Components: Modal forms (client-side rendering)

```html
<!-- Dashboard: HTMX (server-side) -->
<div id="quick-stats" hx-get="/api/v1/analytics/quick-stats-html" hx-trigger="load"></div>

<!-- Modal: Component (client-side) -->
<dialog id="modal_add_transaction">
  <div id="transaction-form-container"></div>
</dialog>

<script type="module">
  import { TransactionForm } from '/static/js/dist/components.bundle.js';

  const form = new TransactionForm({
    container: '#transaction-form-container',
    onSubmit: async (data) => {
      await saveTransaction(data);
    }
  });
</script>
```

**No conflicts:** HTMX updates containers, компоненты управляют формами.

---

### 2. Offline Support Integration

Компоненты интегрируются с offlineManager для offline-first архитектуры.

```typescript
// modules/uiComponents/forms/TransactionForm.ts
export class TransactionForm {
  async submit(): Promise<void> {
    const data = this.collectFormData();

    if (navigator.onLine) {
      try {
        await this.submitToAPI(data);
        showToast('Сохранено', 'success');
      } catch (error) {
        await offlineManager.queueTransaction(data);
        showToast('Сохранено в очередь', 'warning');
      }
    } else {
      await offlineManager.queueTransaction(data);
      showToast('Сохранено оффлайн', 'info');
    }
  }
}
```

**Benefits:**
- ✅ Automatic offline detection
- ✅ IndexedDB queue integration
- ✅ Sync when back online

---

### 3. ModalKeyboardAdapter Integration

BaseModal автоматически интегрируется с существующим ModalKeyboardAdapter.

```typescript
// modules/uiComponents/modals/BaseModal.ts
export class BaseModal {
  render(): HTMLDialogElement {
    this.dialog = document.createElement('dialog');
    this.dialog.id = this.props.id;
    this.dialog.className = 'modal';

    // Integrate with ModalKeyboardAdapter (if available)
    if (typeof ModalKeyboardAdapter !== 'undefined') {
      try {
        const adapter = ModalKeyboardAdapter.getInstance();
        adapter.attachToModal(this.dialog);
      } catch (error) {
        console.warn('[BaseModal] Failed to attach ModalKeyboardAdapter:', error);
      }
    }

    return this.dialog;
  }
}
```

**Benefits:**
- ✅ Keyboard navigation (Escape, Tab, Enter)
- ✅ Focus trap
- ✅ ZERO manual setup

---

## Build System

### Rollup Configuration

```javascript
// rollup.config.mjs
export default [
  // Existing bundles (budgetShared, bundle.js, webapp)
  { /* ... */ },

  // NEW: Component library bundle
  {
    input: 'frontend/web/static/js/modules/uiComponents/index.ts',
    output: {
      file: 'frontend/web/static/js/dist/components.bundle.js',
      format: 'iife',
      name: 'UIComponents',
      sourcemap: !production,
      generatedCode: { constBindings: true }
    },
    plugins: [
      typescript({ tsconfig: './tsconfig.json' }),
      resolve({ browser: true }),
      commonjs(),
      production && terser({
        compress: { passes: 2, drop_console: false },
        mangle: { properties: false }
      })
    ].filter(Boolean)
  }
];
```

### TypeScript Path Mapping

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@web/*": ["frontend/web/static/js/*"],
      "@webapp/*": ["frontend/webapp/static/js/*"],
      "@shared/*": ["frontend/shared/static/js/*"],
      "@components/*": ["frontend/web/static/js/modules/uiComponents/*"]
    }
  }
}
```

### npm Scripts

```json
// package.json
{
  "scripts": {
    "bundle:components": "rollup -c --environment INPUT:uiComponents",
    "watch:components": "rollup -c --environment INPUT:uiComponents -w",
    "test:components": "vitest run modules/uiComponents",
    "analyze:components": "NODE_ENV=production ANALYZE=true rollup -c --environment INPUT:uiComponents"
  }
}
```

### Bundle Size Breakdown

| Phase | Components | Lines | Bundle Size (minified) |
|-------|-----------|-------|------------------------|
| Phase 1 | Base (7) | 1,453 | 15KB |
| Phase 2 | Composite (5) | 963 | +12KB (27KB total) |
| Phase 3 | Forms (4) | 2,077 | +28KB (55KB total) |
| Phase 4 | Modals (3) | 904 | +10KB (65KB total) |

**Total:** 65KB minified, ~18KB gzipped (with Brotli compression)

---

## Migration from Jinja2 to Components

### Old Pattern: Jinja2 Macro

```html
<!-- OLD: templates/components/modal_transaction.html -->
{% macro transaction_modal(modal_id) %}
<dialog id="{{ modal_id }}" class="modal">
  <div class="modal-box">
    <h3>Добавить транзакцию</h3>
    <form>
      <label>Дата</label>
      <input type="text" name="fact_date">
      <!-- ... 150+ lines of HTML ... -->
    </form>
  </div>
</dialog>
{% endmacro %}

<!-- Usage -->
{% from "components/modal_transaction.html" import transaction_modal %}
{{ transaction_modal('modal_add_transaction') }}
```

### New Pattern: Component Initialization

```html
<!-- NEW: templates/index.html -->
<dialog id="modal_add_transaction" class="modal">
  <div id="transaction-form-container"></div>
</dialog>

<script type="module">
  import { TransactionForm, CrudModal } from '/static/js/dist/components.bundle.js';

  const modal = new CrudModal({
    id: 'modal_add_transaction',
    entity: 'transaction',
    createTitle: 'Добавить транзакцию',
    editTitle: 'Редактировать транзакцию',
    formBuilder: (mode, data) => {
      return new TransactionForm({
        container: '#transaction-form-container',
        mode: mode,
        initialData: data
      });
    },
    onCreate: async (data) => {
      const response = await fetch('/api/v1/facts', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onUpdate: async (id, data) => {
      const response = await fetch(`/api/v1/facts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: () => {
      window.dispatchEvent(new CustomEvent('transaction-saved'));
    }
  });

  // Open for create
  document.querySelector('[data-action="add-transaction"]').addEventListener('click', () => {
    modal.openForCreate();
  });
</script>
```

### Migration Benefits

| Before (Jinja2) | After (Components) |
|-----------------|-------------------|
| 150+ lines HTML per form | 20-30 lines JavaScript |
| Копипаста для вариантов | Один компонент, многократное использование |
| Нет type safety | TypeScript type safety |
| Нет offline support | Built-in offline support |
| Manual validation | Automatic validation |
| Inconsistent styling | DaisyUI consistency |

---

## Component Playground

Interactive component showcase доступен по адресу: `/admin/components-playground`

**Features:**
- Live examples для всех 19 компонентов
- Usage code snippets
- Architecture documentation
- Stats dashboard (lines, bundle size, components)
- Interactive validation demos

**Example Usage:**

```javascript
// AmountInput demo
function validateAmount() {
  const amountInput = new UIComponents.AmountInput({
    name: 'demo_amount',
    label: 'Amount',
    min: 1,
    max: 1000000,
    step: 1,
    required: true
  });

  const result = amountInput.validate();
  alert(result.valid ? 'Valid!' : `Error: ${result.error}`);
}
```

---

## Usage Examples

### Example 1: Simple Form with Validation

```typescript
import { FormField, TextInput, AmountInput, DateInput } from '@components';

// Create form fields
const nameInput = new TextInput({
  name: 'name',
  label: 'Name',
  required: true,
  placeholder: 'Enter name'
});

const amountInput = new AmountInput({
  name: 'amount',
  label: 'Amount',
  required: true,
  min: 1,
  max: 1000000,
  step: 1
});

const dateInput = new DateInput({
  name: 'date',
  label: 'Date',
  required: true,
  mode: 'single'
});

// Validate
const validation = amountInput.validate();
if (!validation.valid) {
  console.error(validation.error);
}

// Collect data
const formData = {
  name: nameInput.getValue(),
  amount: amountInput.getValue(),
  date: dateInput.getValue()
};
```

### Example 2: Generic CRUD Modal

```typescript
import { CrudModal, AdminCrudForm } from '@components';

interface CostCenter {
  id?: number;
  name: string;
  description: string;
  is_active: boolean;
}

const modal = new CrudModal<CostCenter>({
  id: 'cost-center-modal',
  entity: 'cost center',
  createTitle: 'Create Cost Center',
  editTitle: 'Edit Cost Center',
  formBuilder: (mode, data) => {
    return new AdminCrudForm<CostCenter>({
      entity: 'cost_center',
      mode: mode,
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'is_active', label: 'Active', type: 'checkbox' }
      ],
      initialData: data
    });
  },
  onCreate: async (data) => {
    const response = await fetch('/api/v1/cost-centers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },
  onUpdate: async (id, data) => {
    const response = await fetch(`/api/v1/cost-centers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },
  onDelete: async (id) => {
    await fetch(`/api/v1/cost-centers/${id}`, { method: 'DELETE' });
  },
  onSuccess: (mode, data) => {
    console.log(`${mode} successful:`, data);
    reloadTable();
  }
});

// Render modal to DOM
document.body.appendChild(modal.render());

// Open for create
modal.openForCreate();

// Open for edit
modal.openForEdit({ id: 123, name: 'IT Department', description: 'IT costs', is_active: true });
```

### Example 3: Custom Form with Dynamic Filtering

```typescript
import { TransactionForm } from '@components';

const form = new TransactionForm({
  container: '#transaction-form-container',
  mode: 'create',
  initialData: null,
  onSubmit: async (data) => {
    if (navigator.onLine) {
      const response = await fetch('/api/v1/facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error('Failed to save transaction');
      }

      return response.json();
    } else {
      // Queue for offline sync
      await offlineManager.queueTransaction(data);
      return { id: null, queued: true };
    }
  }
});

// Switch between expense/income
form.switchType('expense');

// Get current form data
const data = form.collectFormData();
console.log(data);
```

---

## Testing Strategy

### Unit Tests (Vitest)

```typescript
// modules/uiComponents/core/AmountInput.test.ts
import { describe, it, expect } from 'vitest';
import { AmountInput } from './AmountInput';

describe('AmountInput', () => {
  it('should render with correct attributes', () => {
    const input = new AmountInput({
      name: 'amount',
      min: 1,
      max: 1000,
      step: 1
    });

    const element = input.getElement();
    expect(element?.type).toBe('number');
    expect(element?.min).toBe('1');
    expect(element?.max).toBe('1000');
  });

  it('should validate min/max constraints', () => {
    const input = new AmountInput({ name: 'amount', min: 10, max: 100 });

    input.setValue(5);
    expect(input.validate()).toEqual({
      valid: false,
      error: 'Минимальное значение: 10'
    });

    input.setValue(50);
    expect(input.validate()).toEqual({ valid: true });

    input.setValue(150);
    expect(input.validate()).toEqual({
      valid: false,
      error: 'Максимальное значение: 100'
    });
  });
});
```

### Integration Tests (Vitest + MSW)

```typescript
// modules/uiComponents/forms/TransactionForm.test.ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { TransactionForm } from './TransactionForm';

const server = setupServer(
  http.post('/api/v1/facts', () => {
    return HttpResponse.json({ id: 123, status: 'success' });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('TransactionForm', () => {
  it('should submit transaction to API when online', async () => {
    const container = document.createElement('div');
    const form = new TransactionForm({
      container: container,
      mode: 'create'
    });

    form.setValue('amount', 1000);
    form.setValue('fact_date', '01.01.2026');

    const result = await form.submit();

    expect(result.success).toBe(true);
    expect(result.id).toBe(123);
  });
});
```

---

## Performance Optimization

### 1. Bundle Size Optimization

```bash
# Analyze bundle size
npm run analyze:components

# Opens bundle-stats-components.html with:
# - Treemap visualization
# - Module dependencies
# - Duplicate detection
```

**Optimization Techniques:**
- ✅ Tree-shaking via Rollup
- ✅ Terser compression (2 passes)
- ✅ Code splitting (separate bundle)
- ✅ Dead code elimination
- ✅ Brotli pre-compression

### 2. Lazy Loading (Future)

```typescript
// Future: Lazy load forms on demand
const { TransactionForm } = await import('/static/js/dist/components.bundle.js');
const form = new TransactionForm({ /* ... */ });
```

### 3. Service Worker Caching

```javascript
// Service Worker automatically caches components.bundle.js
const CACHE_NAME = 'budget-v7.1.0';
const STATIC_ASSETS = [
  '/static/js/dist/components.bundle.js',
  // ... other assets
];
```

---

## Future Enhancements

### Phase 6: Testing Infrastructure (Future)

- Unit tests for all components (80%+ coverage)
- Integration tests with MSW
- E2E tests with Playwright
- Visual regression tests

### Phase 7: Advanced Components (Future)

- DataTable component (pagination, sorting, filtering)
- ChartWidget wrapper (Chart.js integration)
- FileUpload component (drag-drop + preview)
- ColorPicker component (DaisyUI theme colors)

### Phase 8: Performance (Future)

- Code splitting by route
- Lazy loading for large forms
- Virtual scrolling for long lists
- Web Worker offloading

---

## Troubleshooting

### Build Errors

**Error:** `Cannot find module '@components'`

**Solution:**
```bash
# Verify tsconfig.json paths
cat tsconfig.json | grep -A5 "paths"

# Rebuild bundle
npm run bundle:components
```

**Error:** `Unexpected token 'export'`

**Solution:** Browser doesn't support ES modules. Use IIFE bundle:
```html
<script src="/static/js/dist/components.bundle.js"></script>
<script>
  const { TransactionForm } = window.UIComponents;
</script>
```

### Runtime Errors

**Error:** `CalendarWidget is not defined`

**Solution:** Ensure budgetShared.bundle.js loads before components.bundle.js:
```html
<script src="/static/js/dist/budgetShared.bundle.js"></script>
<script src="/static/js/dist/components.bundle.js"></script>
```

**Error:** `Cannot read property 'validate' of null`

**Solution:** Component not initialized. Ensure container exists:
```typescript
const container = document.querySelector('#form-container');
if (!container) {
  console.error('Container not found!');
  return;
}
```

---

## References

- **Implementation Plan:** `/home/ikeniborn/Documents/Project/claude/.nvm-isolated/.claude-isolated/plans/validated-tickling-treehouse.md`
- **Component Playground:** `/admin/components-playground` (live demos)
- **Build System:** `rollup.config.mjs` (bundle configuration)
- **TypeScript Config:** `tsconfig.json` (path mappings)
- **Existing Widgets:** `frontend/shared/static/js/budgetShared.ts` (CalendarWidget, ChoicesCategoryTree)

---

## Summary

**Component System v1.3.0** provides:

✅ **19 Components** (7 Base + 5 Composite + 4 Forms + 3 Modals)
✅ **65KB Bundle** (18KB gzipped) - Acceptable for offline-first PWA
✅ **~2,000 Lines Saved** - 60%+ reduction in duplication
✅ **ZERO Refactoring** - Existing widgets wrapped without modifications
✅ **Type Safety** - Full TypeScript support with generics
✅ **Offline Support** - Integrates with offlineManager
✅ **DaisyUI Styling** - Consistent with existing UI
✅ **Interactive Docs** - Component Playground for testing

**Highest ROI:** AdminCrudForm<T> saves ~1,200 lines across admin panels.

**Next Steps:**
1. Migrate remaining Jinja2 forms to components
2. Add unit tests (80%+ coverage target)
3. Performance monitoring (bundle size tracking)
4. Advanced components (DataTable, ChartWidget)
