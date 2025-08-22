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
  <!-- Main large dark navy semicircle on the left -->
  <div class="shape main-semicircle"></div>

  <!-- Beige triangle overlapping -->
  <div class="shape beige-triangle"></div>

  <!-- Blue rounded rectangle -->
  <div class="shape blue-rectangle">
    <div class="financial-symbol">$</div>
  </div>

  <!-- Gray rounded rectangle -->
  <div class="shape gray-rectangle">
    <div class="financial-symbol">%</div>
  </div>

  <!-- Small financial icons in colored circles -->
  <div class="shape icon-circle chart-circle">
    <div class="financial-symbol">📊</div>
  </div>

  <div class="shape icon-circle coin-circle">
    <div class="financial-symbol">💰</div>
  </div>
</div>

<style>
  .abstract-graphics {
    position: relative;
    width: 100%;
    height: 240px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .shape {
    position: absolute;
    pointer-events: none;
    transition: transform 0.3s ease-out;
  }

  /* Main large dark navy semicircle on the left */
  .main-semicircle {
    left: -20px;
    top: 50%;
    transform: translateY(-50%);
    width: 160px;
    height: 160px;
    background: #1e3a5f;
    border-radius: 0 160px 160px 0;
    z-index: 1;
  }

  .main-semicircle:hover {
    transform: translateY(-50%) translate(calc(var(--mouse-x) * 3px), calc(var(--mouse-y) * 3px));
  }

  /* Beige triangle overlapping */
  .beige-triangle {
    left: 80px;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-left: 60px solid transparent;
    border-right: 60px solid transparent;
    border-bottom: 100px solid #d4b896;
    z-index: 2;
  }

  .beige-triangle:hover {
    transform: translateY(-50%) translate(calc(var(--mouse-x) * -2px), calc(var(--mouse-y) * -2px));
  }

  /* Blue rounded rectangle */
  .blue-rectangle {
    right: 60px;
    top: 30%;
    width: 80px;
    height: 50px;
    background: #7bb3e0;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3;
  }

  .blue-rectangle:hover {
    transform: translate(calc(var(--mouse-x) * 4px), calc(var(--mouse-y) * 4px));
  }

  /* Gray rounded rectangle */
  .gray-rectangle {
    right: 20px;
    top: 60%;
    width: 70px;
    height: 40px;
    background: #a8c0d0;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3;
  }

  .gray-rectangle:hover {
    transform: translate(calc(var(--mouse-x) * -3px), calc(var(--mouse-y) * -3px));
  }

  /* Small financial icons in colored circles */
  .icon-circle {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 4;
  }

  .chart-circle {
    right: 140px;
    top: 20%;
    background: #7bb3e0;
  }

  .chart-circle:hover {
    transform: translate(calc(var(--mouse-x) * 2px), calc(var(--mouse-y) * 2px));
  }

  .coin-circle {
    right: 120px;
    bottom: 15%;
    background: #d4b896;
  }

  .coin-circle:hover {
    transform: translate(calc(var(--mouse-x) * -2px), calc(var(--mouse-y) * -2px));
  }

  /* Financial symbols */
  .financial-symbol {
    font-size: 1.25rem;
    font-weight: bold;
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .gray-rectangle .financial-symbol,
  .coin-circle .financial-symbol {
    color: #1e3a5f;
    text-shadow: none;
  }

  .icon-circle .financial-symbol {
    font-size: 1rem;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .abstract-graphics {
      height: 180px;
    }

    .main-semicircle {
      width: 120px;
      height: 120px;
      border-radius: 0 120px 120px 0;
    }

    .beige-triangle {
      border-left: 45px solid transparent;
      border-right: 45px solid transparent;
      border-bottom: 75px solid #d4b896;
      left: 60px;
    }

    .blue-rectangle {
      width: 60px;
      height: 40px;
      right: 40px;
    }

    .gray-rectangle {
      width: 55px;
      height: 30px;
      right: 15px;
    }

    .icon-circle {
      width: 32px;
      height: 32px;
    }

    .chart-circle {
      right: 100px;
    }

    .coin-circle {
      right: 90px;
    }

    .financial-symbol {
      font-size: 1rem;
    }

    .icon-circle .financial-symbol {
      font-size: 0.875rem;
    }
  }

  @media (max-width: 480px) {
    .abstract-graphics {
      height: 140px;
    }

    .main-semicircle {
      width: 100px;
      height: 100px;
      border-radius: 0 100px 100px 0;
    }

    .beige-triangle {
      border-left: 35px solid transparent;
      border-right: 35px solid transparent;
      border-bottom: 60px solid #d4b896;
      left: 50px;
    }

    .blue-rectangle {
      width: 50px;
      height: 30px;
      right: 30px;
    }

    .gray-rectangle {
      width: 45px;
      height: 25px;
      right: 10px;
    }

    .icon-circle {
      width: 28px;
      height: 28px;
    }

    .chart-circle {
      right: 80px;
    }

    .coin-circle {
      right: 75px;
    }

    .financial-symbol {
      font-size: 0.875rem;
    }

    .icon-circle .financial-symbol {
      font-size: 0.75rem;
    }
  }
</style>