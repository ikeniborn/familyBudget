<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  let container: HTMLDivElement;
  let mouseX = 0;
  let mouseY = 0;

  // Parallax effect on mouse movement
  function handleMouseMove(event: MouseEvent) {
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    mouseX = (event.clientX - rect.left - rect.width / 2) / rect.width;
    mouseY = (event.clientY - rect.top - rect.height / 2) / rect.height;
  }

  onMount(() => {
    if (browser && container) {
      container.addEventListener('mousemove', handleMouseMove);
      return () => {
        container.removeEventListener('mousemove', handleMouseMove);
      };
    }
  });
</script>

<div 
  bind:this={container}
  class="abstract-graphics"
  style="--mouse-x: {mouseX}; --mouse-y: {mouseY}"
>
  <svg viewBox="0 0 500 400" class="graphics-svg" xmlns="http://www.w3.org/2000/svg">
    <!-- Define gradients for depth -->
    <defs>
      <linearGradient id="navyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#1e3a5f;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#152940;stop-opacity:1" />
      </linearGradient>
      <linearGradient id="beigeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#d4b896;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#c8a882;stop-opacity:1" />
      </linearGradient>
      <linearGradient id="lightBlueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#b8d5f0;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#a8c5e0;stop-opacity:1" />
      </linearGradient>
      <linearGradient id="grayBlueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#9fb4c8;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#8fa4b8;stop-opacity:1" />
      </linearGradient>
    </defs>
    
    <!-- Organic background shapes matching the reference design -->
    
    <!-- Large dark navy organic shape (left-center) -->
    <path d="M0 150 Q30 100 80 110 Q130 115 160 140 Q180 165 175 200 Q170 240 140 260 Q110 280 70 270 Q30 260 10 220 Q-5 180 0 150 Z" 
          fill="url(#navyGradient)" 
          opacity="0.95"
          class="shape-dark-navy" />
    
    <!-- Additional smaller navy shape (top-left) -->
    <path d="M60 40 Q90 20 130 35 Q160 50 165 80 Q170 110 145 125 Q120 140 85 130 Q50 120 40 90 Q30 60 60 40 Z" 
          fill="#1e3a5f" 
          opacity="0.85"
          class="shape-dark-navy-small" />
    
    <!-- Large beige/sandy organic form (center-right) -->
    <path d="M200 120 Q260 100 320 125 Q380 150 395 200 Q410 250 370 290 Q330 330 270 315 Q210 300 185 250 Q160 200 175 160 Q190 130 200 120 Z" 
          fill="url(#beigeGradient)" 
          opacity="0.92"
          class="shape-beige" />
    
    <!-- Light blue flowing form (bottom-left to center) -->
    <path d="M50 280 Q120 260 190 275 Q260 290 275 330 Q290 370 240 385 Q190 400 130 385 Q70 370 45 335 Q20 300 35 275 Q45 260 50 280 Z" 
          fill="url(#lightBlueGradient)" 
          opacity="0.88"
          class="shape-light-blue" />
    
    <!-- Gray-blue circular form (top-right) -->
    <path d="M380 50 Q430 30 480 60 Q520 90 515 140 Q510 190 460 210 Q410 230 365 215 Q320 200 305 160 Q290 120 310 85 Q330 50 380 50 Z" 
          fill="url(#grayBlueGradient)" 
          opacity="0.9"
          class="shape-gray-blue" />
    
    <!-- Additional medium blue accent shape -->
    <path d="M250 250 Q290 235 330 255 Q370 275 365 310 Q360 345 320 355 Q280 365 245 350 Q210 335 205 300 Q200 265 250 250 Z" 
          fill="#8fa4b8" 
          opacity="0.6"
          class="shape-accent" />

    <!-- Financial icon circles with enhanced design -->
    
    <!-- Upper left circle - Growth chart with arrow -->
    <g class="icon-group-1">
      <circle cx="120" cy="140" r="35" fill="#ffffff" stroke="#5a9fd4" stroke-width="2" opacity="0.95" />
      <circle cx="120" cy="140" r="35" fill="none" stroke="#7bb3e0" stroke-width="1" opacity="0.5" />
      
      <!-- Detailed growth chart icon -->
      <g transform="translate(120, 140)">
        <!-- Grid lines -->
        <line x1="-15" y1="10" x2="15" y2="10" stroke="#d0e5f7" stroke-width="0.5" />
        <line x1="-15" y1="5" x2="15" y2="5" stroke="#d0e5f7" stroke-width="0.5" />
        <line x1="-15" y1="0" x2="15" y2="0" stroke="#d0e5f7" stroke-width="0.5" />
        <line x1="-15" y1="-5" x2="15" y2="-5" stroke="#d0e5f7" stroke-width="0.5" />
        
        <!-- Chart axes -->
        <path d="M-15 -12 L-15 12 L15 12" stroke="#1e3a5f" stroke-width="2" fill="none" stroke-linecap="round" />
        
        <!-- Growth line with points -->
        <polyline points="-10,8 -5,4 0,1 5,-3 10,-8" stroke="#5a9fd4" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        
        <!-- Data points -->
        <circle cx="-10" cy="8" r="2" fill="#5a9fd4" />
        <circle cx="-5" cy="4" r="2" fill="#5a9fd4" />
        <circle cx="0" cy="1" r="2" fill="#5a9fd4" />
        <circle cx="5" cy="-3" r="2" fill="#5a9fd4" />
        <circle cx="10" cy="-8" r="2" fill="#5a9fd4" />
        
        <!-- Growth arrow -->
        <path d="M8 -10 L12 -10 L12 -6" stroke="#4caf50" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        <polyline points="10,-12 12,-10 14,-12" stroke="#4caf50" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
    
    <!-- Upper right circle - Dollar plants/growth -->
    <g class="icon-group-2">
      <circle cx="350" cy="190" r="38" fill="#ffffff" stroke="#5a9fd4" stroke-width="2" opacity="0.95" />
      <circle cx="350" cy="190" r="38" fill="none" stroke="#7bb3e0" stroke-width="1" opacity="0.5" />
      
      <!-- Dollar plants growing -->
      <g transform="translate(350, 190)">
        <!-- Ground line -->
        <line x1="-20" y1="12" x2="20" y2="12" stroke="#8fa4b8" stroke-width="1.5" />
        
        <!-- Left dollar plant -->
        <g transform="translate(-12, 0)">
          <!-- Stem -->
          <line x1="0" y1="12" x2="0" y2="-2" stroke="#4caf50" stroke-width="2" stroke-linecap="round" />
          <!-- Leaves -->
          <ellipse cx="-3" cy="3" rx="3" ry="5" fill="#66bb6a" opacity="0.8" transform="rotate(-30 -3 3)" />
          <ellipse cx="3" cy="5" rx="3" ry="5" fill="#66bb6a" opacity="0.8" transform="rotate(30 3 5)" />
          <!-- Dollar sign flower -->
          <circle cx="0" cy="-5" r="6" fill="#ffd54f" stroke="#f9a825" stroke-width="1" />
          <text x="0" y="-2" text-anchor="middle" font-size="8" font-weight="bold" fill="#1e3a5f">$</text>
        </g>
        
        <!-- Center dollar plant (tallest) -->
        <g transform="translate(0, 0)">
          <!-- Stem -->
          <line x1="0" y1="12" x2="0" y2="-8" stroke="#4caf50" stroke-width="2.5" stroke-linecap="round" />
          <!-- Leaves -->
          <ellipse cx="-4" cy="0" rx="3" ry="6" fill="#66bb6a" opacity="0.8" transform="rotate(-25 -4 0)" />
          <ellipse cx="4" cy="2" rx="3" ry="6" fill="#66bb6a" opacity="0.8" transform="rotate(25 4 2)" />
          <!-- Dollar sign flower -->
          <circle cx="0" cy="-11" r="7" fill="#ffd54f" stroke="#f9a825" stroke-width="1" />
          <text x="0" y="-8" text-anchor="middle" font-size="9" font-weight="bold" fill="#1e3a5f">$</text>
        </g>
        
        <!-- Right dollar plant -->
        <g transform="translate(12, 0)">
          <!-- Stem -->
          <line x1="0" y1="12" x2="0" y2="2" stroke="#4caf50" stroke-width="1.8" stroke-linecap="round" />
          <!-- Leaves -->
          <ellipse cx="-3" cy="6" rx="2.5" ry="4" fill="#66bb6a" opacity="0.8" transform="rotate(-35 -3 6)" />
          <ellipse cx="3" cy="7" rx="2.5" ry="4" fill="#66bb6a" opacity="0.8" transform="rotate(35 3 7)" />
          <!-- Dollar sign flower (bud) -->
          <circle cx="0" cy="-1" r="5" fill="#ffd54f" stroke="#f9a825" stroke-width="1" />
          <text x="0" y="2" text-anchor="middle" font-size="7" font-weight="bold" fill="#1e3a5f">$</text>
        </g>
      </g>
    </g>
    
    <!-- Bottom circle - Coin stacks with percentages -->
    <g class="icon-group-3">
      <circle cx="200" cy="310" r="36" fill="#ffffff" stroke="#5a9fd4" stroke-width="2" opacity="0.95" />
      <circle cx="200" cy="310" r="36" fill="none" stroke="#7bb3e0" stroke-width="1" opacity="0.5" />
      
      <!-- Coin stacks with percentage symbols -->
      <g transform="translate(200, 310)">
        <!-- Left coin stack -->
        <g transform="translate(-12, 0)">
          <!-- Stack of coins -->
          <ellipse cx="0" cy="10" rx="6" ry="2" fill="#ffd54f" stroke="#f9a825" stroke-width="0.5" />
          <rect x="-6" y="4" width="12" height="6" fill="#ffd54f" />
          <ellipse cx="0" cy="4" rx="6" ry="2" fill="#ffeb3b" stroke="#f9a825" stroke-width="0.5" />
          <rect x="-6" y="-2" width="12" height="6" fill="#ffd54f" />
          <ellipse cx="0" cy="-2" rx="6" ry="2" fill="#ffeb3b" stroke="#f9a825" stroke-width="0.5" />
          <rect x="-6" y="-8" width="12" height="6" fill="#ffd54f" />
          <ellipse cx="0" cy="-8" rx="6" ry="2" fill="#ffeb3b" stroke="#f9a825" stroke-width="0.5" />
          <!-- Percentage above -->
          <text x="0" y="-12" text-anchor="middle" font-size="6" font-weight="bold" fill="#4caf50">+5%</text>
        </g>
        
        <!-- Center coin stack (tallest) -->
        <g transform="translate(0, 0)">
          <!-- Stack of coins -->
          <ellipse cx="0" cy="10" rx="7" ry="2.5" fill="#ffd54f" stroke="#f9a825" stroke-width="0.5" />
          <rect x="-7" y="2" width="14" height="8" fill="#ffd54f" />
          <ellipse cx="0" cy="2" rx="7" ry="2.5" fill="#ffeb3b" stroke="#f9a825" stroke-width="0.5" />
          <rect x="-7" y="-6" width="14" height="8" fill="#ffd54f" />
          <ellipse cx="0" cy="-6" rx="7" ry="2.5" fill="#ffeb3b" stroke="#f9a825" stroke-width="0.5" />
          <rect x="-7" y="-14" width="14" height="8" fill="#ffd54f" />
          <ellipse cx="0" cy="-14" rx="7" ry="2.5" fill="#ffeb3b" stroke="#f9a825" stroke-width="0.5" />
          <!-- Dollar sign on top coin -->
          <text x="0" y="-12" text-anchor="middle" font-size="5" font-weight="bold" fill="#f9a825">$</text>
          <!-- Percentage above -->
          <text x="0" y="-20" text-anchor="middle" font-size="7" font-weight="bold" fill="#4caf50">+12%</text>
        </g>
        
        <!-- Right coin stack -->
        <g transform="translate(13, 0)">
          <!-- Stack of coins -->
          <ellipse cx="0" cy="10" rx="5" ry="2" fill="#ffd54f" stroke="#f9a825" stroke-width="0.5" />
          <rect x="-5" y="6" width="10" height="4" fill="#ffd54f" />
          <ellipse cx="0" cy="6" rx="5" ry="2" fill="#ffeb3b" stroke="#f9a825" stroke-width="0.5" />
          <rect x="-5" y="2" width="10" height="4" fill="#ffd54f" />
          <ellipse cx="0" cy="2" rx="5" ry="2" fill="#ffeb3b" stroke="#f9a825" stroke-width="0.5" />
          <!-- Percentage above -->
          <text x="0" y="-3" text-anchor="middle" font-size="6" font-weight="bold" fill="#4caf50">+8%</text>
        </g>
      </g>
    </g>
  </svg>
</div>

<style>
  .abstract-graphics {
    position: relative;
    width: 100%;
    height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 2rem;
    overflow: hidden;
    background: linear-gradient(135deg, rgba(248, 250, 252, 0.5) 0%, rgba(241, 245, 249, 0.5) 100%);
    border-radius: 20px;
  }

  .graphics-svg {
    width: 100%;
    height: 100%;
    max-width: 500px;
    transition: transform 0.2s ease-out;
  }

  /* Organic shape animations with parallax */
  .shape-dark-navy {
    transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    transform-origin: center;
    filter: drop-shadow(0 4px 6px rgba(30, 58, 95, 0.1));
  }

  .abstract-graphics:hover .shape-dark-navy {
    transform: translate(calc(var(--mouse-x) * 4px), calc(var(--mouse-y) * 3px));
  }

  .shape-dark-navy-small {
    transition: transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    transform-origin: center;
    filter: drop-shadow(0 2px 4px rgba(30, 58, 95, 0.08));
  }

  .abstract-graphics:hover .shape-dark-navy-small {
    transform: translate(calc(var(--mouse-x) * 3px), calc(var(--mouse-y) * 2px));
  }

  .shape-beige {
    transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    transform-origin: center;
    filter: drop-shadow(0 4px 6px rgba(200, 168, 130, 0.1));
  }

  .abstract-graphics:hover .shape-beige {
    transform: translate(calc(var(--mouse-x) * -3px), calc(var(--mouse-y) * 2px));
  }

  .shape-light-blue {
    transition: transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    transform-origin: center;
    filter: drop-shadow(0 4px 6px rgba(168, 197, 224, 0.1));
  }

  .abstract-graphics:hover .shape-light-blue {
    transform: translate(calc(var(--mouse-x) * 3px), calc(var(--mouse-y) * 4px));
  }

  .shape-gray-blue {
    transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    transform-origin: center;
    filter: drop-shadow(0 4px 6px rgba(143, 164, 184, 0.1));
  }

  .abstract-graphics:hover .shape-gray-blue {
    transform: translate(calc(var(--mouse-x) * -2px), calc(var(--mouse-y) * -3px));
  }

  .shape-accent {
    transition: transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    transform-origin: center;
  }

  .abstract-graphics:hover .shape-accent {
    transform: translate(calc(var(--mouse-x) * 2px), calc(var(--mouse-y) * -2px));
  }

  /* Icon groups with enhanced parallax and shadows */
  .icon-group-1 {
    transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    transform-origin: center;
    filter: drop-shadow(0 6px 12px rgba(90, 159, 212, 0.15));
  }

  .abstract-graphics:hover .icon-group-1 {
    transform: translate(calc(var(--mouse-x) * 5px), calc(var(--mouse-y) * 4px)) scale(1.02);
  }

  .icon-group-2 {
    transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    transform-origin: center;
    filter: drop-shadow(0 6px 12px rgba(90, 159, 212, 0.15));
  }

  .abstract-graphics:hover .icon-group-2 {
    transform: translate(calc(var(--mouse-x) * -4px), calc(var(--mouse-y) * 3px)) scale(1.02);
  }

  .icon-group-3 {
    transition: transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    transform-origin: center;
    filter: drop-shadow(0 6px 12px rgba(90, 159, 212, 0.15));
  }

  .abstract-graphics:hover .icon-group-3 {
    transform: translate(calc(var(--mouse-x) * 3px), calc(var(--mouse-y) * -4px)) scale(1.02);
  }

  /* Text elements styling */
  text {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .abstract-graphics {
      height: 340px;
      border-radius: 16px;
    }

    .graphics-svg {
      max-width: 450px;
    }

    /* Reduce parallax intensity on tablets */
    .abstract-graphics:hover .shape-dark-navy {
      transform: translate(calc(var(--mouse-x) * 3px), calc(var(--mouse-y) * 2px));
    }

    .abstract-graphics:hover .shape-beige {
      transform: translate(calc(var(--mouse-x) * -2px), calc(var(--mouse-y) * 1.5px));
    }

    .abstract-graphics:hover .shape-light-blue {
      transform: translate(calc(var(--mouse-x) * 2px), calc(var(--mouse-y) * 3px));
    }

    .abstract-graphics:hover .shape-gray-blue {
      transform: translate(calc(var(--mouse-x) * -1.5px), calc(var(--mouse-y) * -2px));
    }

    .abstract-graphics:hover .icon-group-1 {
      transform: translate(calc(var(--mouse-x) * 3px), calc(var(--mouse-y) * 2.5px)) scale(1.01);
    }

    .abstract-graphics:hover .icon-group-2 {
      transform: translate(calc(var(--mouse-x) * -2.5px), calc(var(--mouse-y) * 2px)) scale(1.01);
    }

    .abstract-graphics:hover .icon-group-3 {
      transform: translate(calc(var(--mouse-x) * 2px), calc(var(--mouse-y) * -2.5px)) scale(1.01);
    }
  }

  @media (max-width: 480px) {
    .abstract-graphics {
      height: 280px;
      border-radius: 12px;
    }

    .graphics-svg {
      max-width: 380px;
    }

    /* Minimal parallax on mobile for performance */
    .abstract-graphics:hover .shape-dark-navy {
      transform: translate(calc(var(--mouse-x) * 1.5px), calc(var(--mouse-y) * 1px));
    }

    .abstract-graphics:hover .shape-dark-navy-small {
      transform: translate(calc(var(--mouse-x) * 1px), calc(var(--mouse-y) * 0.8px));
    }

    .abstract-graphics:hover .shape-beige {
      transform: translate(calc(var(--mouse-x) * -1px), calc(var(--mouse-y) * 0.8px));
    }

    .abstract-graphics:hover .shape-light-blue {
      transform: translate(calc(var(--mouse-x) * 1px), calc(var(--mouse-y) * 1.5px));
    }

    .abstract-graphics:hover .shape-gray-blue {
      transform: translate(calc(var(--mouse-x) * -0.8px), calc(var(--mouse-y) * -1px));
    }

    .abstract-graphics:hover .shape-accent {
      transform: translate(calc(var(--mouse-x) * 0.8px), calc(var(--mouse-y) * -0.8px));
    }

    .abstract-graphics:hover .icon-group-1 {
      transform: translate(calc(var(--mouse-x) * 1.5px), calc(var(--mouse-y) * 1px)) scale(1);
    }

    .abstract-graphics:hover .icon-group-2 {
      transform: translate(calc(var(--mouse-x) * -1px), calc(var(--mouse-y) * 0.8px)) scale(1);
    }

    .abstract-graphics:hover .icon-group-3 {
      transform: translate(calc(var(--mouse-x) * 1px), calc(var(--mouse-y) * -1px)) scale(1);
    }
  }

  /* Disable parallax on touch devices */
  @media (hover: none) and (pointer: coarse) {
    .abstract-graphics:hover .shape-dark-navy,
    .abstract-graphics:hover .shape-dark-navy-small,
    .abstract-graphics:hover .shape-beige,
    .abstract-graphics:hover .shape-light-blue,
    .abstract-graphics:hover .shape-gray-blue,
    .abstract-graphics:hover .shape-accent,
    .abstract-graphics:hover .icon-group-1,
    .abstract-graphics:hover .icon-group-2,
    .abstract-graphics:hover .icon-group-3 {
      transform: none;
    }
  }

  /* Animation on load */
  @keyframes fadeInScale {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .abstract-graphics {
    animation: fadeInScale 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  }

  /* Stagger animations for shapes */
  .shape-dark-navy { animation-delay: 0.1s; }
  .shape-dark-navy-small { animation-delay: 0.15s; }
  .shape-beige { animation-delay: 0.2s; }
  .shape-light-blue { animation-delay: 0.25s; }
  .shape-gray-blue { animation-delay: 0.3s; }
  .shape-accent { animation-delay: 0.35s; }
  .icon-group-1 { animation-delay: 0.4s; }
  .icon-group-2 { animation-delay: 0.45s; }
  .icon-group-3 { animation-delay: 0.5s; }
</style>