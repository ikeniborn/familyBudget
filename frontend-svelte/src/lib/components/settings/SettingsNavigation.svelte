<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { isAdmin } from '$lib/stores/auth.store';
  import Card from '../ui/Card.svelte';
  import {
    Calendar,
    Building2,
    Briefcase,
    Tags,
    Users,
    Settings,
    FileText,
    Shield,
    Database,
    ChevronRight,
    BookOpen
  } from 'lucide-svelte';

  interface SettingCategory {
    id: string;
    title: string;
    description: string;
    icon: any;
    color: string;
    items: SettingItem[];
  }

  interface SettingItem {
    id: string;
    label: string;
    description: string;
    path: string;
    icon: any;
  }

  const settingsCategories: SettingCategory[] = [
    {
      id: 'reference-data',
      title: 'Справочники',
      description: 'Основные справочники системы',
      icon: Database,
      color: 'blue',
      items: [
        {
          id: 'periods',
          label: 'Периоды',
          description: 'Управление временными периодами',
          path: '/settings/periods',
          icon: Calendar,
        },
        {
          id: 'financial-centers',
          label: 'Финансовые центры',
          description: 'Центры финансовой ответственности',
          path: '/settings/financial-centers',
          icon: Building2,
        },
        {
          id: 'cost-centers',
          label: 'Центры затрат',
          description: 'Места возникновения затрат',
          path: '/settings/cost-centers',
          icon: Briefcase,
        },
      ],
    },
    {
      id: 'catalog-data',
      title: 'Каталоги',
      description: 'Управление каталогами и категориями',
      icon: BookOpen,
      color: 'green',
      items: [
        {
          id: 'articles',
          label: 'Статьи',
          description: 'Группировка номенклатур по статьям',
          path: '/settings/articles',
          icon: FileText,
        },
        {
          id: 'nomenclatures',
          label: 'Номенклатуры',
          description: 'Категории доходов и расходов',
          path: '/settings/nomenclatures',
          icon: Tags,
        },
      ],
    },
    {
      id: 'system-settings',
      title: 'Система',
      description: 'Системные настройки и безопасность',
      icon: Settings,
      color: 'purple',
      items: [
        {
          id: 'users',
          label: 'Пользователи',
          description: 'Управление пользователями',
          path: '/settings/users',
          icon: Users,
        },
        {
          id: 'security',
          label: 'Безопасность',
          description: 'Настройки безопасности',
          path: '/settings/security',
          icon: Shield,
        },
        {
          id: 'import-export',
          label: 'Импорт/Экспорт',
          description: 'Массовые операции с данными',
          path: '/settings/import-export',
          icon: FileText,
        },
      ],
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string; hover: string }> = {
      blue: { 
        bg: 'bg-blue-50', 
        text: 'text-blue-600', 
        border: 'border-blue-200',
        hover: 'hover:bg-blue-100' 
      },
      green: { 
        bg: 'bg-green-50', 
        text: 'text-green-600', 
        border: 'border-green-200',
        hover: 'hover:bg-green-100' 
      },
      purple: { 
        bg: 'bg-purple-50', 
        text: 'text-purple-600', 
        border: 'border-purple-200',
        hover: 'hover:bg-purple-100' 
      },
    };
    return colors[color] || colors.blue;
  };

  const navigateToPath = (path: string) => {
    if ($page.url.pathname !== path) {
      goto(path);
    }
  };

  $: currentPath = $page.url.pathname;
  
  // Filter categories based on admin status - only admins see all categories
  $: visibleCategories = settingsCategories.filter(category => {
    // Only admins can see all categories
    if (!$isAdmin) {
      return false; // Regular users see no settings categories
    }
    return true; // Admins see all categories
  });
</script>

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {#each visibleCategories as category}
    {@const Icon = category.icon}
    {@const colors = getColorClasses(category.color)}
    
    <Card class="overflow-hidden">
      <div class="{colors.bg} {colors.border} border-b p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg bg-white">
            <svelte:component this={Icon} class="h-6 w-6 {colors.text}" />
          </div>
          <div>
            <h3 class="font-semibold text-gray-900">{category.title}</h3>
            <p class="text-sm text-gray-600">{category.description}</p>
          </div>
        </div>
      </div>
      
      <div class="p-0">
        <div class="divide-y">
          {#each category.items as item}
            {@const ItemIcon = item.icon}
            {@const isActive = currentPath === item.path}
            
            <button
              on:click={() => navigateToPath(item.path)}
              class="
                w-full text-left block px-4 py-3 transition-colors
                {isActive 
                  ? `${colors.bg} ${colors.border} border-l-4` 
                  : 'hover:bg-gray-50'
                }
              "
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <svelte:component this={ItemIcon} class="h-5 w-5 {isActive ? colors.text : 'text-gray-400'}" />
                  <div>
                    <p class="font-medium {isActive ? 'text-gray-900' : 'text-gray-700'}">
                      {item.label}
                    </p>
                    <p class="text-sm text-gray-500">
                      {item.description}
                    </p>
                  </div>
                </div>
                <ChevronRight class="h-4 w-4 {isActive ? colors.text : 'text-gray-400'}" />
              </div>
            </button>
          {/each}
        </div>
      </div>
    </Card>
  {/each}
</div>