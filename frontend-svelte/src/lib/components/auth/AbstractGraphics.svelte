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
  <!-- Left side: Dark navy semicircle with beige triangle -->
  <div class="left-composition">
    <div class="shape navy-semicircle"></div>
    <div class="shape beige-triangle"></div>
  </div>

  <!-- Right side: Financial elements -->
  <div class="right-composition">
    <!-- Blue circle with chart icon at top -->
    <div class="shape icon-circle blue-chart">
      <span class="icon">📊</span>
    </div>
    
    <!-- Blue rectangle with dollar -->
    <div class="shape blue-rect">
      <span class="dollar">$</span>
    </div>
    
    <!-- Yellow/beige circle with dollar -->
    <div class="shape icon-circle yellow-dollar">
      <span class="dollar-icon">$</span>
    </div>
    
    <!-- Gray rectangle with percent -->
    <div class="shape gray-rect">
      <span class="percent">%</span>
    </div>
  </div>
</div>

<style>
  .abstract-graphics {
    position: relative;
    width: 100%;
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 2rem;
  }

  .left-composition {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 300px;
    height: 150px;
  }

  .right-composition {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 300px;
    height: 150px;
  }

  .shape {
    position: absolute;
    transition: transform 0.3s ease-out;
  }

  /* Left side - Navy semicircle */
  .navy-semicircle {
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 120px;
    height: 120px;
    background: #2d4a7c;
    border-radius: 120px 0 0 120px;
  }

  .navy-semicircle:hover {
    transform: translateY(-50%) translate(calc(var(--mouse-x) * 2px), calc(var(--mouse-y) * 2px));
  }

  /* Beige triangle */
  .beige-triangle {
    left: 60px;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0 0 80px 80px;
    border-color: transparent transparent #c8a882 transparent;
  }

  .beige-triangle:hover {
    transform: translateY(-50%) translate(calc(var(--mouse-x) * -2px), calc(var(--mouse-y) * -2px));
  }

  /* Right side elements */
  
  /* Blue circle with chart at top */
  .blue-chart {
    right: 80px;
    top: 10px;
    width: 36px;
    height: 36px;
    background: #7bb3e0;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .blue-chart:hover {
    transform: translate(calc(var(--mouse-x) * 3px), calc(var(--mouse-y) * 3px));
  }

  /* Blue rectangle with dollar */
  .blue-rect {
    right: 20px;
    top: 30px;
    width: 60px;
    height: 36px;
    background: #7bb3e0;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .blue-rect:hover {
    transform: translate(calc(var(--mouse-x) * -3px), calc(var(--mouse-y) * -3px));
  }

  /* Yellow circle with dollar */
  .yellow-dollar {
    right: 90px;
    bottom: 30px;
    width: 32px;
    height: 32px;
    background: #c8a882;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .yellow-dollar:hover {
    transform: translate(calc(var(--mouse-x) * 2px), calc(var(--mouse-y) * 2px));
  }

  /* Gray rectangle with percent */
  .gray-rect {
    right: 30px;
    bottom: 25px;
    width: 50px;
    height: 32px;
    background: #9db3c8;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .gray-rect:hover {
    transform: translate(calc(var(--mouse-x) * -2px), calc(var(--mouse-y) * -2px));
  }

  /* Icons and text */
  .icon {
    font-size: 16px;
    filter: grayscale(100%);
  }

  .dollar, .dollar-icon {
    color: white;
    font-size: 20px;
    font-weight: bold;
  }

  .percent {
    color: #2d4a7c;
    font-size: 18px;
    font-weight: bold;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .abstract-graphics {
      height: 160px;
    }

    .left-composition,
    .right-composition {
      width: 250px;
      height: 120px;
    }

    .navy-semicircle {
      width: 100px;
      height: 100px;
      border-radius: 100px 0 0 100px;
    }

    .beige-triangle {
      left: 50px;
      border-width: 0 0 65px 65px;
    }

    .blue-chart {
      width: 30px;
      height: 30px;
      right: 70px;
    }

    .blue-rect {
      width: 50px;
      height: 30px;
      right: 15px;
    }

    .yellow-dollar {
      width: 28px;
      height: 28px;
      right: 75px;
    }

    .gray-rect {
      width: 42px;
      height: 28px;
      right: 25px;
    }

    .icon {
      font-size: 14px;
    }

    .dollar, .dollar-icon {
      font-size: 16px;
    }

    .percent {
      font-size: 14px;
    }
  }

  @media (max-width: 480px) {
    .abstract-graphics {
      height: 140px;
    }

    .left-composition,
    .right-composition {
      width: 220px;
      height: 100px;
    }

    .navy-semicircle {
      width: 80px;
      height: 80px;
      border-radius: 80px 0 0 80px;
    }

    .beige-triangle {
      left: 40px;
      border-width: 0 0 50px 50px;
    }

    .blue-chart {
      width: 26px;
      height: 26px;
      right: 60px;
      top: 15px;
    }

    .blue-rect {
      width: 42px;
      height: 26px;
      right: 12px;
      top: 25px;
    }

    .yellow-dollar {
      width: 24px;
      height: 24px;
      right: 65px;
      bottom: 25px;
    }

    .gray-rect {
      width: 36px;
      height: 24px;
      right: 20px;
      bottom: 20px;
    }

    .icon {
      font-size: 12px;
    }

    .dollar, .dollar-icon {
      font-size: 14px;
    }

    .percent {
      font-size: 12px;
    }
  }
</style>