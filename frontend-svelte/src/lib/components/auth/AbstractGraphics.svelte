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
  <svg viewBox="0 0 400 300" class="graphics-svg">
    <!-- Organic background shapes -->
    <!-- Main dark navy blob -->
    <path d="M20 150 Q50 80 120 100 Q180 90 200 130 Q220 180 170 200 Q100 220 60 180 Q30 160 20 150 Z" 
          fill="#1a2f4b" 
          class="shape-1" />
    
    <!-- Large beige organic shape -->
    <path d="M150 80 Q220 60 280 100 Q320 140 300 180 Q270 220 220 210 Q170 200 140 160 Q120 120 150 80 Z" 
          fill="#d4b896" 
          class="shape-2" />
    
    <!-- Blue organic shape -->
    <path d="M80 180 Q130 160 180 180 Q220 200 210 240 Q190 270 150 260 Q100 250 70 220 Q60 190 80 180 Z" 
          fill="#7bb3e0" 
          class="shape-3" />
    
    <!-- Gray-blue organic shape -->
    <path d="M240 50 Q290 40 330 80 Q360 120 340 160 Q320 190 280 180 Q240 170 220 130 Q210 90 240 50 Z" 
          fill="#9db3c8" 
          class="shape-4" />

    <!-- Financial icon circles with light blue background -->
    <!-- Circle 1: Chart with arrow up (growth) -->
    <circle cx="120" cy="120" r="28" fill="#e1f0ff" stroke="#7bb3e0" stroke-width="2" class="icon-circle-1" />
    
    <!-- Circle 2: Money/coins (income) -->
    <circle cx="220" cy="160" r="30" fill="#e1f0ff" stroke="#7bb3e0" stroke-width="2" class="icon-circle-2" />
    
    <!-- Circle 3: Stack of coins (savings) -->
    <circle cx="160" cy="220" r="26" fill="#e1f0ff" stroke="#7bb3e0" stroke-width="2" class="icon-circle-3" />
  </svg>

  <!-- Icon overlays positioned absolutely -->
  <div class="icon-overlay icon-1">
    <!-- Chart with arrow up icon -->
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a2f4b" stroke-width="2">
      <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"></polyline>
      <polyline points="18,8 22,12 18,16"></polyline>
    </svg>
  </div>

  <div class="icon-overlay icon-2">
    <!-- Money/dollar growth icon -->
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1a2f4b" stroke-width="2">
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
      <polyline points="7,3 12,1 17,3"></polyline>
    </svg>
  </div>

  <div class="icon-overlay icon-3">
    <!-- Coins stack icon -->
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a2f4b" stroke-width="2">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M12 1v6m0 6v6"></path>
      <path d="m21 12-6-3-6 3-6-3"></path>
      <path d="m21 12-6 3-6-3-6 3"></path>
      <circle cx="12" cy="8" r="2"></circle>
      <circle cx="12" cy="16" r="2"></circle>
    </svg>
  </div>
</div>

<style>
  .abstract-graphics {
    position: relative;
    width: 100%;
    height: 280px;
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
    transition: transform 0.3s ease-out;
  }

  .graphics-svg:hover {
    transform: translate(calc(var(--mouse-x) * 3px), calc(var(--mouse-y) * 3px));
  }

  /* Organic shape animations with parallax */
  .shape-1 {
    transition: transform 0.4s ease-out;
    transform-origin: center;
  }

  .abstract-graphics:hover .shape-1 {
    transform: translate(calc(var(--mouse-x) * 2px), calc(var(--mouse-y) * 2px));
  }

  .shape-2 {
    transition: transform 0.3s ease-out;
    transform-origin: center;
  }

  .abstract-graphics:hover .shape-2 {
    transform: translate(calc(var(--mouse-x) * -2px), calc(var(--mouse-y) * -1px));
  }

  .shape-3 {
    transition: transform 0.5s ease-out;
    transform-origin: center;
  }

  .abstract-graphics:hover .shape-3 {
    transform: translate(calc(var(--mouse-x) * 1px), calc(var(--mouse-y) * 3px));
  }

  .shape-4 {
    transition: transform 0.4s ease-out;
    transform-origin: center;
  }

  .abstract-graphics:hover .shape-4 {
    transform: translate(calc(var(--mouse-x) * -1px), calc(var(--mouse-y) * -2px));
  }

  /* Icon circles with subtle parallax */
  .icon-circle-1 {
    transition: transform 0.3s ease-out;
    transform-origin: center;
  }

  .abstract-graphics:hover .icon-circle-1 {
    transform: translate(calc(var(--mouse-x) * 4px), calc(var(--mouse-y) * 4px));
  }

  .icon-circle-2 {
    transition: transform 0.4s ease-out;
    transform-origin: center;
  }

  .abstract-graphics:hover .icon-circle-2 {
    transform: translate(calc(var(--mouse-x) * -3px), calc(var(--mouse-y) * 3px));
  }

  .icon-circle-3 {
    transition: transform 0.3s ease-out;
    transform-origin: center;
  }

  .abstract-graphics:hover .icon-circle-3 {
    transform: translate(calc(var(--mouse-x) * 2px), calc(var(--mouse-y) * -2px));
  }

  /* Icon overlay positioning */
  .icon-overlay {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    transition: transform 0.3s ease-out;
  }

  .icon-1 {
    left: 22%;
    top: 32%;
    transform: translate(-50%, -50%);
  }

  .abstract-graphics:hover .icon-1 {
    transform: translate(-50%, -50%) translate(calc(var(--mouse-x) * 4px), calc(var(--mouse-y) * 4px));
  }

  .icon-2 {
    left: 52%;
    top: 48%;
    transform: translate(-50%, -50%);
  }

  .abstract-graphics:hover .icon-2 {
    transform: translate(-50%, -50%) translate(calc(var(--mouse-x) * -3px), calc(var(--mouse-y) * 3px));
  }

  .icon-3 {
    left: 36%;
    top: 68%;
    transform: translate(-50%, -50%);
  }

  .abstract-graphics:hover .icon-3 {
    transform: translate(-50%, -50%) translate(calc(var(--mouse-x) * 2px), calc(var(--mouse-y) * -2px));
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .abstract-graphics {
      height: 240px;
    }

    .graphics-svg {
      max-width: 420px;
    }

    .icon-1 svg {
      width: 20px;
      height: 20px;
    }

    .icon-2 svg {
      width: 24px;
      height: 24px;
    }

    .icon-3 svg {
      width: 20px;
      height: 20px;
    }
  }

  @media (max-width: 480px) {
    .abstract-graphics {
      height: 200px;
    }

    .graphics-svg {
      max-width: 350px;
    }

    .icon-1 svg {
      width: 18px;
      height: 18px;
    }

    .icon-2 svg {
      width: 22px;
      height: 22px;
    }

    .icon-3 svg {
      width: 18px;
      height: 18px;
    }

    /* Reduce parallax effect on mobile */
    .abstract-graphics:hover .shape-1 {
      transform: translate(calc(var(--mouse-x) * 1px), calc(var(--mouse-y) * 1px));
    }

    .abstract-graphics:hover .shape-2 {
      transform: translate(calc(var(--mouse-x) * -1px), calc(var(--mouse-y) * -0.5px));
    }

    .abstract-graphics:hover .shape-3 {
      transform: translate(calc(var(--mouse-x) * 0.5px), calc(var(--mouse-y) * 1.5px));
    }

    .abstract-graphics:hover .shape-4 {
      transform: translate(calc(var(--mouse-x) * -0.5px), calc(var(--mouse-y) * -1px));
    }

    .abstract-graphics:hover .icon-circle-1 {
      transform: translate(calc(var(--mouse-x) * 2px), calc(var(--mouse-y) * 2px));
    }

    .abstract-graphics:hover .icon-circle-2 {
      transform: translate(calc(var(--mouse-x) * -1.5px), calc(var(--mouse-y) * 1.5px));
    }

    .abstract-graphics:hover .icon-circle-3 {
      transform: translate(calc(var(--mouse-x) * 1px), calc(var(--mouse-y) * -1px));
    }

    .abstract-graphics:hover .icon-1 {
      transform: translate(-50%, -50%) translate(calc(var(--mouse-x) * 2px), calc(var(--mouse-y) * 2px));
    }

    .abstract-graphics:hover .icon-2 {
      transform: translate(-50%, -50%) translate(calc(var(--mouse-x) * -1.5px), calc(var(--mouse-y) * 1.5px));
    }

    .abstract-graphics:hover .icon-3 {
      transform: translate(-50%, -50%) translate(calc(var(--mouse-x) * 1px), calc(var(--mouse-y) * -1px));
    }
  }
</style>