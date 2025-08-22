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
  <!-- Large decorative circle with financial symbol -->
  <div class="shape shape-circle-large">
    <div class="financial-symbol">$</div>
  </div>

  <!-- Medium circle with chart icon -->
  <div class="shape shape-circle-medium">
    <div class="financial-symbol">📊</div>
  </div>

  <!-- Small circle with coin icon -->
  <div class="shape shape-circle-small">
    <div class="financial-symbol">💰</div>
  </div>

  <!-- Rectangle with percentage -->
  <div class="shape shape-rectangle">
    <div class="financial-symbol">%</div>
  </div>

  <!-- Triangle elements -->
  <div class="shape shape-triangle-up"></div>
  <div class="shape shape-triangle-down"></div>

  <!-- Abstract geometric lines -->
  <div class="shape shape-line-1"></div>
  <div class="shape shape-line-2"></div>

  <!-- Floating dots -->
  <div class="floating-dot dot-1"></div>
  <div class="floating-dot dot-2"></div>
  <div class="floating-dot dot-3"></div>
  <div class="floating-dot dot-4"></div>
</div>

<style>
  .abstract-graphics {
    position: relative;
    width: 100%;
    height: 300px;
    overflow: hidden;
    margin-bottom: 2rem;
  }

  .shape {
    position: absolute;
    pointer-events: none;
    transition: transform 0.6s ease-out;
  }

  /* Main geometric shapes with financial symbols */
  .shape-circle-large {
    top: 10%;
    right: 15%;
    width: 120px;
    height: 120px;
    background: linear-gradient(135deg, hsl(203, 46%, 66%) 0%, hsl(205, 24%, 73%) 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 32px rgba(30, 58, 95, 0.15);
    animation: float 6s ease-in-out infinite;
    transform: translate(calc(var(--mouse-x) * 10px), calc(var(--mouse-y) * 10px));
  }

  .shape-circle-medium {
    top: 60%;
    left: 20%;
    width: 80px;
    height: 80px;
    background: hsl(40, 33%, 70%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6px 24px rgba(212, 184, 150, 0.3);
    animation: float 5s ease-in-out infinite reverse;
    animation-delay: -1s;
    transform: translate(calc(var(--mouse-x) * -8px), calc(var(--mouse-y) * -8px));
  }

  .shape-circle-small {
    top: 25%;
    left: 10%;
    width: 60px;
    height: 60px;
    background: hsl(205, 24%, 73%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(168, 192, 208, 0.4);
    animation: float 4s ease-in-out infinite;
    animation-delay: -2s;
    transform: translate(calc(var(--mouse-x) * 6px), calc(var(--mouse-y) * 6px));
  }

  .shape-rectangle {
    top: 40%;
    right: 10%;
    width: 100px;
    height: 60px;
    background: linear-gradient(45deg, hsl(210, 69%, 25%) 0%, hsl(203, 46%, 66%) 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6px 24px rgba(30, 58, 95, 0.2);
    animation: float 7s ease-in-out infinite;
    animation-delay: -3s;
    transform: translate(calc(var(--mouse-x) * -12px), calc(var(--mouse-y) * -12px));
  }

  /* Triangle shapes */
  .shape-triangle-up {
    bottom: 30%;
    right: 25%;
    width: 0;
    height: 0;
    border-left: 25px solid transparent;
    border-right: 25px solid transparent;
    border-bottom: 40px solid hsl(210, 69%, 25%);
    opacity: 0.7;
    animation: float 8s ease-in-out infinite;
    animation-delay: -4s;
    transform: translate(calc(var(--mouse-x) * 8px), calc(var(--mouse-y) * 8px));
  }

  .shape-triangle-down {
    top: 70%;
    left: 60%;
    width: 0;
    height: 0;
    border-left: 20px solid transparent;
    border-right: 20px solid transparent;
    border-top: 30px solid hsl(40, 33%, 70%);
    opacity: 0.6;
    animation: float 6s ease-in-out infinite reverse;
    animation-delay: -1.5s;
    transform: translate(calc(var(--mouse-x) * -6px), calc(var(--mouse-y) * -6px));
  }

  /* Abstract lines */
  .shape-line-1 {
    top: 15%;
    left: 40%;
    width: 150px;
    height: 3px;
    background: linear-gradient(90deg, transparent 0%, hsl(203, 46%, 66%) 50%, transparent 100%);
    transform: rotate(25deg);
    opacity: 0.4;
    animation: float 10s ease-in-out infinite;
    transform: rotate(25deg) translate(calc(var(--mouse-x) * 4px), calc(var(--mouse-y) * 4px));
  }

  .shape-line-2 {
    bottom: 25%;
    left: 30%;
    width: 120px;
    height: 2px;
    background: linear-gradient(90deg, transparent 0%, hsl(205, 24%, 73%) 50%, transparent 100%);
    transform: rotate(-15deg);
    opacity: 0.3;
    animation: float 9s ease-in-out infinite reverse;
    animation-delay: -2s;
    transform: rotate(-15deg) translate(calc(var(--mouse-x) * -4px), calc(var(--mouse-y) * -4px));
  }

  /* Financial symbols inside shapes */
  .financial-symbol {
    font-size: 1.5rem;
    font-weight: bold;
    color: white;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .shape-circle-medium .financial-symbol,
  .shape-circle-small .financial-symbol {
    color: hsl(210, 69%, 25%);
    text-shadow: none;
  }

  .shape-rectangle .financial-symbol {
    font-size: 1.25rem;
  }

  .shape-circle-small .financial-symbol {
    font-size: 1rem;
  }

  /* Floating dots */
  .floating-dot {
    position: absolute;
    width: 8px;
    height: 8px;
    background: hsl(203, 46%, 66%);
    border-radius: 50%;
    opacity: 0.6;
    animation: float 12s ease-in-out infinite;
  }

  .dot-1 {
    top: 20%;
    left: 70%;
    animation-delay: -5s;
    transform: translate(calc(var(--mouse-x) * 3px), calc(var(--mouse-y) * 3px));
  }

  .dot-2 {
    top: 80%;
    left: 80%;
    background: hsl(40, 33%, 70%);
    animation-delay: -7s;
    transform: translate(calc(var(--mouse-x) * -3px), calc(var(--mouse-y) * -3px));
  }

  .dot-3 {
    top: 50%;
    left: 5%;
    background: hsl(205, 24%, 73%);
    animation-delay: -3s;
    transform: translate(calc(var(--mouse-x) * 2px), calc(var(--mouse-y) * 2px));
  }

  .dot-4 {
    top: 10%;
    left: 50%;
    background: hsl(210, 69%, 25%);
    animation-delay: -9s;
    transform: translate(calc(var(--mouse-x) * -2px), calc(var(--mouse-y) * -2px));
  }

  /* Floating animation */
  @keyframes float {
    0%, 100% {
      transform: translateY(0px) translateX(0px);
    }
    25% {
      transform: translateY(-10px) translateX(5px);
    }
    50% {
      transform: translateY(0px) translateX(10px);
    }
    75% {
      transform: translateY(10px) translateX(5px);
    }
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .abstract-graphics {
      height: 200px;
    }

    .shape-circle-large {
      width: 80px;
      height: 80px;
    }

    .shape-circle-medium {
      width: 60px;
      height: 60px;
    }

    .shape-circle-small {
      width: 40px;
      height: 40px;
    }

    .shape-rectangle {
      width: 70px;
      height: 40px;
    }

    .financial-symbol {
      font-size: 1rem;
    }

    .shape-rectangle .financial-symbol {
      font-size: 0.875rem;
    }

    .shape-circle-small .financial-symbol {
      font-size: 0.75rem;
    }

    .shape-line-1,
    .shape-line-2 {
      width: 100px;
    }
  }

  @media (max-width: 480px) {
    .abstract-graphics {
      height: 150px;
    }

    .shape-circle-large {
      width: 60px;
      height: 60px;
    }

    .shape-circle-medium {
      width: 45px;
      height: 45px;
    }

    .shape-circle-small {
      width: 30px;
      height: 30px;
    }

    .shape-rectangle {
      width: 50px;
      height: 30px;
    }
  }
</style>