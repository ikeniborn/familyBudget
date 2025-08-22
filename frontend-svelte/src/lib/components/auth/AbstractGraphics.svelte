<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  let container: HTMLDivElement;
  let mouseX = 0;
  let mouseY = 0;

  // Subtle parallax effect on mouse movement
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
  <svg viewBox="0 0 500 380" class="graphics-svg">
    <!-- Organic background shapes following the sketch layout -->
    
    <!-- 1. Dark navy organic form (left part) -->
    <path d="M20 120 Q50 80 120 90 Q180 95 210 140 Q240 180 220 230 Q200 280 150 290 Q90 300 50 260 Q20 220 15 180 Q10 140 20 120 Z" 
          fill="#1e3a5f" 
          class="shape-dark-navy" />
    
    <!-- 2. Beige/sandy circular form (center) -->
    <path d="M180 160 Q230 140 280 160 Q320 180 330 220 Q340 260 300 290 Q260 310 220 300 Q180 290 160 250 Q150 210 160 180 Q170 160 180 160 Z" 
          fill="#c8a882" 
          class="shape-beige" />
    
    <!-- 3. Light blue oval form (lower left) -->
    <path d="M80 240 Q140 220 200 240 Q250 255 260 290 Q270 325 220 340 Q170 355 120 345 Q70 335 50 305 Q35 275 50 250 Q65 240 80 240 Z" 
          fill="#a8c5e0" 
          class="shape-light-blue" />
    
    <!-- 4. Gray-blue circular form (right upper) -->
    <path d="M350 80 Q400 60 450 90 Q490 120 485 160 Q480 200 440 220 Q400 240 360 225 Q320 210 310 175 Q300 140 320 110 Q340 80 350 80 Z" 
          fill="#8fa4b8" 
          class="shape-gray-blue" />

    <!-- White circles with blue border for icons -->
    
    <!-- Upper left circle - chart icon -->
    <circle cx="140" cy="130" r="30" fill="#ffffff" stroke="#7bb3e0" stroke-width="2.5" class="icon-circle-1" />
    
    <!-- Center right circle - dollar sign -->
    <circle cx="320" cy="180" r="32" fill="#ffffff" stroke="#7bb3e0" stroke-width="2.5" class="icon-circle-2" />
    
    <!-- Lower circle - star/coins icon -->
    <circle cx="200" cy="290" r="28" fill="#ffffff" stroke="#7bb3e0" stroke-width="2.5" class="icon-circle-3" />
  </svg>

  <!-- Icon overlays positioned absolutely -->
  <div class="icon-overlay icon-1">
    <!-- Chart/analytics icon -->
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1e3a5f" stroke-width="2.5">
      <path d="M3 3v18h18"></path>
      <path d="m19 9-5 5-4-4-3 3"></path>
      <polyline points="14,9 19,9 19,14"></polyline>
    </svg>
  </div>

  <div class="icon-overlay icon-2">
    <!-- Dollar sign icon -->
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1e3a5f" stroke-width="2.5">
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
  </div>

  <div class="icon-overlay icon-3">
    <!-- Star/achievement icon -->
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1e3a5f" stroke-width="2.5">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
    </svg>
  </div>
</div>

<style>
  .abstract-graphics {
    position: relative;
    width: 100%;
    height: 380px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 2rem;
    overflow: hidden;
  }

  .graphics-svg {
    width: 100%;
    height: 100%;
    max-width: 500px;
    transition: transform 0.2s ease-out;
  }

  .graphics-svg:hover {
    transform: translate(calc(var(--mouse-x) * 2px), calc(var(--mouse-y) * 2px));
  }

  /* Organic shape animations with subtle parallax */
  .shape-dark-navy {
    transition: transform 0.4s ease-out;
    transform-origin: center;
  }

  .abstract-graphics:hover .shape-dark-navy {
    transform: translate(calc(var(--mouse-x) * 3px), calc(var(--mouse-y) * 2px));
  }

  .shape-beige {
    transition: transform 0.3s ease-out;
    transform-origin: center;
  }

  .abstract-graphics:hover .shape-beige {
    transform: translate(calc(var(--mouse-x) * -2px), calc(var(--mouse-y) * 1px));
  }

  .shape-light-blue {
    transition: transform 0.5s ease-out;
    transform-origin: center;
  }

  .abstract-graphics:hover .shape-light-blue {
    transform: translate(calc(var(--mouse-x) * 2px), calc(var(--mouse-y) * 3px));
  }

  .shape-gray-blue {
    transition: transform 0.4s ease-out;
    transform-origin: center;
  }

  .abstract-graphics:hover .shape-gray-blue {
    transform: translate(calc(var(--mouse-x) * -1px), calc(var(--mouse-y) * -2px));
  }

  /* Icon circles with coordinated parallax */
  .icon-circle-1 {
    transition: transform 0.3s ease-out;
    transform-origin: center;
  }

  .abstract-graphics:hover .icon-circle-1 {
    transform: translate(calc(var(--mouse-x) * 4px), calc(var(--mouse-y) * 3px));
  }

  .icon-circle-2 {
    transition: transform 0.4s ease-out;
    transform-origin: center;
  }

  .abstract-graphics:hover .icon-circle-2 {
    transform: translate(calc(var(--mouse-x) * -3px), calc(var(--mouse-y) * 2px));
  }

  .icon-circle-3 {
    transition: transform 0.3s ease-out;
    transform-origin: center;
  }

  .abstract-graphics:hover .icon-circle-3 {
    transform: translate(calc(var(--mouse-x) * 2px), calc(var(--mouse-y) * -3px));
  }

  /* Icon overlay positioning - matching the sketch layout */
  .icon-overlay {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    transition: transform 0.3s ease-out;
  }

  /* Upper left chart icon */
  .icon-1 {
    left: 28%;
    top: 34%;
    transform: translate(-50%, -50%);
  }

  .abstract-graphics:hover .icon-1 {
    transform: translate(-50%, -50%) translate(calc(var(--mouse-x) * 4px), calc(var(--mouse-y) * 3px));
  }

  /* Center right dollar icon */
  .icon-2 {
    left: 64%;
    top: 47%;
    transform: translate(-50%, -50%);
  }

  .abstract-graphics:hover .icon-2 {
    transform: translate(-50%, -50%) translate(calc(var(--mouse-x) * -3px), calc(var(--mouse-y) * 2px));
  }

  /* Lower star icon */
  .icon-3 {
    left: 40%;
    top: 76%;
    transform: translate(-50%, -50%);
  }

  .abstract-graphics:hover .icon-3 {
    transform: translate(-50%, -50%) translate(calc(var(--mouse-x) * 2px), calc(var(--mouse-y) * -3px));
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .abstract-graphics {
      height: 320px;
    }

    .graphics-svg {
      max-width: 450px;
    }

    .icon-1 svg {
      width: 20px;
      height: 20px;
    }

    .icon-2 svg {
      width: 22px;
      height: 22px;
    }

    .icon-3 svg {
      width: 18px;
      height: 18px;
    }
  }

  @media (max-width: 480px) {
    .abstract-graphics {
      height: 260px;
    }

    .graphics-svg {
      max-width: 380px;
    }

    .icon-1 svg {
      width: 18px;
      height: 18px;
    }

    .icon-2 svg {
      width: 20px;
      height: 20px;
    }

    .icon-3 svg {
      width: 16px;
      height: 16px;
    }

    /* Reduce parallax effect on mobile */
    .abstract-graphics:hover .shape-dark-navy {
      transform: translate(calc(var(--mouse-x) * 1.5px), calc(var(--mouse-y) * 1px));
    }

    .abstract-graphics:hover .shape-beige {
      transform: translate(calc(var(--mouse-x) * -1px), calc(var(--mouse-y) * 0.5px));
    }

    .abstract-graphics:hover .shape-light-blue {
      transform: translate(calc(var(--mouse-x) * 1px), calc(var(--mouse-y) * 1.5px));
    }

    .abstract-graphics:hover .shape-gray-blue {
      transform: translate(calc(var(--mouse-x) * -0.5px), calc(var(--mouse-y) * -1px));
    }

    .abstract-graphics:hover .icon-circle-1 {
      transform: translate(calc(var(--mouse-x) * 2px), calc(var(--mouse-y) * 1.5px));
    }

    .abstract-graphics:hover .icon-circle-2 {
      transform: translate(calc(var(--mouse-x) * -1.5px), calc(var(--mouse-y) * 1px));
    }

    .abstract-graphics:hover .icon-circle-3 {
      transform: translate(calc(var(--mouse-x) * 1px), calc(var(--mouse-y) * -1.5px));
    }

    .abstract-graphics:hover .icon-1 {
      transform: translate(-50%, -50%) translate(calc(var(--mouse-x) * 2px), calc(var(--mouse-y) * 1.5px));
    }

    .abstract-graphics:hover .icon-2 {
      transform: translate(-50%, -50%) translate(calc(var(--mouse-x) * -1.5px), calc(var(--mouse-y) * 1px));
    }

    .abstract-graphics:hover .icon-3 {
      transform: translate(-50%, -50%) translate(calc(var(--mouse-x) * 1px), calc(var(--mouse-y) * -1.5px));
    }
  }
</style>