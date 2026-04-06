/**
 * P2PTemplates - HTML template rendering functions for P2P sync UI.
 *
 * Extracted from P2PUIController.js to separate presentation from logic.
 * All onclick handlers reference window.p2pUI (set by P2PUIController).
 *
 * @version 1.0.0
 */

/**
 * Render iOS microphone permission explanation screen HTML.
 * @param {'initiator'|'responder'} role - Role to continue after user confirms
 * @returns {string} HTML string
 */
export function renderIosMicWarning(role) {
  return `
      <div class="flex flex-col items-center gap-5 p-6 text-center">
        <div class="p-3 rounded-full bg-warning/20">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-7a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z"/>
          </svg>
        </div>
        <div>
          <h3 class="font-semibold text-base">Нужен доступ к микрофону</h3>
          <p class="text-sm text-base-content/70 mt-2">
            iOS требует разрешения на микрофон для установки P2P соединения.<br>
            <span class="text-xs text-base-content/50 mt-1 block">Звук не записывается и не передаётся — доступ нужен только для технической инициализации соединения.</span>
          </p>
        </div>
        <button class="btn btn-primary w-full max-w-xs" onclick="window.p2pUI?.confirmIosMic('${role}')">
          Разрешить и продолжить
        </button>
        <button class="btn btn-ghost btn-sm" onclick="window.p2pUI?.cancel()">Отмена</button>
      </div>
    `;
}

/**
 * Render role selection screen HTML.
 * @param {number|null} pendingCount - null = loading state
 * @returns {string} HTML string
 */
export function renderRoleSelect(pendingCount) {
  const isLoading = pendingCount === null;
  const hasPending = !isLoading && pendingCount > 0;

  const statusBadge = isLoading
    ? `<span class="loading loading-dots loading-xs"></span>`
    : hasPending
      ? `<span class="badge badge-warning badge-sm">${pendingCount} ожидают</span>`
      : `<span class="badge badge-success badge-sm">Синхронизировано</span>`;

  const pendingLabel = isLoading
    ? `<span class="text-base-content/40 text-xs">Проверяем...</span>`
    : hasPending
      ? `<span class="text-warning text-xs font-medium">${pendingCount} ${pendingCount === 1 ? 'запись' : pendingCount < 5 ? 'записи' : 'записей'} не отправлено</span>`
      : `<span class="text-success text-xs">Все данные синхронизированы</span>`;

  return `
      <div class="flex flex-col items-center gap-4 py-4 px-2">

        <div class="text-center">
          <h3 class="text-lg font-bold">P2P Синхронизация</h3>
          <p class="text-xs text-base-content/50 mt-0.5">Синхронизация через 6-значный код</p>
        </div>

        <!-- Current status card -->
        <div class="bg-base-200 rounded-xl px-4 py-3 w-full max-w-xs">
          <div class="flex items-center justify-between">
            <span class="text-sm text-base-content/60">Локальные данные</span>
            ${statusBadge}
          </div>
          <div class="mt-1">${pendingLabel}</div>
        </div>

        <!-- Action buttons -->
        <div class="flex flex-col gap-2 w-full max-w-xs">

          <div class="flex flex-col gap-2">
            <button class="btn btn-primary flex-row h-auto min-h-[3.5rem] py-2 gap-3 text-sm justify-start px-4" onclick="window.p2pUI?.startRelayInitiator()">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/>
              </svg>
              <div class="flex flex-col items-start">
                <span class="font-medium">Получить код</span>
                <span class="text-xs opacity-70">Создать сессию и показать код</span>
              </div>
            </button>

            <button class="btn btn-outline flex-row h-auto min-h-[3.5rem] py-2 gap-3 text-sm justify-start px-4" onclick="window.p2pUI?.startRelayResponder()">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
              </svg>
              <div class="flex flex-col items-start">
                <span class="font-medium">Ввести код</span>
                <span class="text-xs opacity-70">Подключиться по коду с другого устройства</span>
              </div>
            </button>
          </div>

          <button class="btn btn-ghost btn-sm mt-1" onclick="window.p2pUI?.cancel()">Отмена</button>
        </div>

      </div>
    `;
}

/**
 * Render relay code display screen HTML.
 * @param {string} code - The relay code to display (or loading placeholder)
 * @param {number} secondsLeft - Countdown seconds to display
 * @returns {string} HTML string
 */
export function renderRelayCodeScreen(code, secondsLeft) {
  const codeDisplay = code
    ? code
    : '<span class="loading loading-dots loading-md"></span>';

  return [
    '<div class="flex flex-col items-center gap-5 p-4 pb-8 w-full">',
      '<div class="text-center">',
        '<p class="text-sm text-base-content/60 mb-1">Код для подключения</p>',
        '<div id="p2p-relay-code-display" class="text-5xl font-mono font-bold tracking-[0.3em] text-primary py-3 px-4 bg-base-200 rounded-2xl select-all">',
          codeDisplay,
        '</div>',
        '<p class="text-xs text-base-content/40 mt-2">Продиктуйте или покажите этот код другому устройству</p>',
      '</div>',
      '<div class="flex flex-col items-center gap-1 w-full max-w-xs">',
        '<div class="flex items-center gap-2 text-sm text-base-content/50">',
          '<span class="loading loading-ring loading-xs"></span>',
          '<span>Ожидание подключения...</span>',
        '</div>',
        '<div class="flex items-center gap-2 w-full mt-1">',
          '<progress id="p2p-relay-progress" class="progress progress-primary flex-1" value="100" max="100"></progress>',
          '<span id="p2p-relay-timer" class="text-xs font-mono text-base-content/40 w-10 text-right">' + secondsLeft + 's</span>',
        '</div>',
      '</div>',
      '<button class="btn btn-ghost btn-sm" onclick="window.p2pUI?.cancel()">Отмена</button>',
    '</div>',
  ].join('');
}

/**
 * Render relay code entry screen HTML.
 * @returns {string} HTML string
 */
export function renderRelayEnterScreen() {
  return [
    '<div class="flex flex-col items-center gap-5 p-4 pb-8 w-full">',
      '<div class="text-center">',
        '<h3 class="font-semibold text-base">Ввести код</h3>',
        '<p class="text-xs text-base-content/50 mt-1">Введите 6-значный код с другого устройства</p>',
      '</div>',
      '<input id="p2p-relay-input" type="text" maxlength="6" autocomplete="off" autocapitalize="characters"',
        ' spellcheck="false" inputmode="text"',
        ' class="input input-bordered input-lg text-center font-mono tracking-[0.4em] uppercase w-full max-w-xs text-2xl"',
        ' placeholder="XXXXXX"',
        ' oninput="this.value=this.value.toUpperCase()">',
      '<button class="btn btn-primary w-full max-w-xs" onclick="window.p2pUI?.submitRelayCode()">',
        'Подключиться',
      '</button>',
      '<button class="btn btn-ghost btn-sm" onclick="window.p2pUI?.cancel()">Отмена</button>',
    '</div>',
  ].join('');
}

/**
 * Render modal wrapper HTML.
 * @returns {string} HTML string
 */
export function renderModal() {
  return '<div id="p2p-modal-content" class="p-4"></div>';
}
