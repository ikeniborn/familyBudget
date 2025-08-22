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
  <svg viewBox="0 0 500 400" class="graphics-svg">
    <!-- Organic background shapes - увеличенные размеры для большей выразительности -->
    <!-- Main dark navy blob -->
    <path d="M30 200 Q80 100 160 130 Q240 110 280 170 Q300 240 220 270 Q130 300 80 240 Q40 210 30 200 Z" 
          fill="#1a2f4b" 
          class="shape-1" />
    
    <!-- Large beige organic shape -->
    <path d="M200 100 Q290 70 380 130 Q430 190 400 250 Q360 300 290 280 Q220 260 180 210 Q150 160 200 100 Z" 
          fill="#d4b896" 
          class="shape-2" />
    
    <!-- Blue organic shape -->
    <path d="M100 240 Q170 210 240 240 Q290 270 270 320 Q240 360 190 350 Q130 340 90 290 Q80 250 100 240 Z" 
          fill="#7bb3e0" 
          class="shape-3" />
    
    <!-- Gray-blue organic shape -->
    <path d="M320 70 Q390 50 440 110 Q480 170 450 220 Q420 260 370 240 Q320 220 290 170 Q280 120 320 70 Z" 
          fill="#9db3c8" 
          class="shape-4" />

    <!-- Financial icon circles with light blue background - увеличенные размеры -->
    <!-- Circle 1: Chart with arrow up (growth) -->
    <circle cx="160" cy="160" r="35" fill="#e1f0ff" stroke="#7bb3e0" stroke-width="3" class="icon-circle-1" />
    
    <!-- Circle 2: Money/coins (income) -->
    <circle cx="290" cy="210" r="38" fill="#e1f0ff" stroke="#7bb3e0" stroke-width="3" class="icon-circle-2" />
    
    <!-- Circle 3: Stack of coins (savings) -->
    <circle cx="210" cy="290" r="33" fill="#e1f0ff" stroke="#7bb3e0" stroke-width="3" class="icon-circle-3" />
  </svg>

  <!-- Icon overlays positioned absolutely -->
  <div class="icon-overlay icon-1">
    <!-- Chart with arrow up icon -->
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1a2f4b" stroke-width="2">
      <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"></polyline>
      <polyline points="18,8 22,12 18,16"></polyline>
    </svg>
  </div>

  <div class="icon-overlay icon-2">
    <!-- Money/dollar growth icon -->
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1a2f4b" stroke-width="2">
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
      <polyline points="7,3 12,1 17,3"></polyline>
    </svg>
  </div>

  <div class="icon-overlay icon-3">
    <!-- Coins stack icon -->
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1a2f4b" stroke-width="2">
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
    height: 450px;
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
    left: 32%;
    top: 40%;
    transform: translate(-50%, -50%);
  }

  .abstract-graphics:hover .icon-1 {
    transform: translate(-50%, -50%) translate(calc(var(--mouse-x) * 4px), calc(var(--mouse-y) * 4px));
  }

  .icon-2 {
    left: 58%;
    top: 52.5%;
    transform: translate(-50%, -50%);
  }

  .abstract-graphics:hover .icon-2 {
    transform: translate(-50%, -50%) translate(calc(var(--mouse-x) * -3px), calc(var(--mouse-y) * 3px));
  }

  .icon-3 {
    left: 42%;
    top: 72.5%;
    transform: translate(-50%, -50%);
  }

  .abstract-graphics:hover .icon-3 {
    transform: translate(-50%, -50%) translate(calc(var(--mouse-x) * 2px), calc(var(--mouse-y) * -2px));
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .abstract-graphics {
      height: 350px;
    }

    .graphics-svg {
      max-width: 450px;
    }

    .icon-1 svg {
      width: 24px;
      height: 24px;
    }

    .icon-2 svg {
      width: 28px;
      height: 28px;
    }

    .icon-3 svg {
      width: 24px;
      height: 24px;
    }
  }

  @media (max-width: 480px) {
    .abstract-graphics {
      height: 280px;
    }

    .graphics-svg {
      max-width: 380px;
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