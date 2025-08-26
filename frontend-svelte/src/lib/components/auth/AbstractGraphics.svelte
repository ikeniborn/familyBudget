<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  let container: HTMLDivElement;
  let mouseX = 0;
  let mouseY = 0;

  // Interactive icon areas based on the image layout
  const iconAreas = [
    { id: 'growth-chart', x: 15, y: 25, width: 25, height: 25, title: 'График роста доходов' },
    { id: 'money-plants', x: 60, y: 15, width: 25, height: 25, title: 'Выращивание капитала' },
    { id: 'coin-stacks', x: 60, y: 60, width: 25, height: 25, title: 'Накопления и проценты' }
  ];

  let hoveredIcon: string | null = null;

  // Parallax effect on mouse movement
  function handleMouseMove(event: MouseEvent) {
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    mouseX = (event.clientX - rect.left - rect.width / 2) / rect.width;
    mouseY = (event.clientY - rect.top - rect.height / 2) / rect.height;
  }

  function handleIconHover(iconId: string) {
    hoveredIcon = iconId;
  }

  function handleIconLeave() {
    hoveredIcon = null;
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
  <!-- Background image layer (cropped to show only the graphic part) -->
  <div class="background-layer"></div>
  
  <!-- Parallax overlay layers -->
  <div class="parallax-layer layer-1"></div>
  <div class="parallax-layer layer-2"></div>
  <div class="parallax-layer layer-3"></div>
  
  <!-- Interactive icon areas -->
  <div class="interactive-areas">
    {#each iconAreas as area}
      <div
        class="icon-area {hoveredIcon === area.id ? 'hovered' : ''}"
        style="left: {area.x}%; top: {area.y}%; width: {area.width}%; height: {area.height}%;"
        onmouseenter={() => handleIconHover(area.id)}
        onmouseleave={handleIconLeave}
        title={area.title}
        role="button"
        tabindex="0"
      >
        <div class="icon-highlight"></div>
        <div class="icon-ripple"></div>
      </div>
    {/each}
  </div>
  
  <!-- Floating particles for ambient animation -->
  <div class="floating-particles">
    {#each Array(6) as _, i}
      <div class="particle particle-{i + 1}"></div>
    {/each}
  </div>
  
  <!-- Tooltip for hovered icons -->
  {#if hoveredIcon}
    <div class="icon-tooltip">
      {iconAreas.find(area => area.id === hoveredIcon)?.title}
    </div>
  {/if}
</div>

<style>
  .abstract-graphics {
    position: relative;
    width: 100%;
    height: 400px;
    margin: 0 auto 2rem;
    overflow: hidden;
    border-radius: 20px;
    cursor: none;
    background: linear-gradient(135deg, 
      rgba(248, 250, 252, 0.8) 0%, 
      rgba(241, 245, 249, 0.8) 100%);
  }

  /* Background layer with cropped image */
  .background-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url('/images/login-graphics.jpg');
    background-size: 120% auto; /* Scale up to crop out text and button */
    background-position: center -50px; /* Move up to show only graphics */
    background-repeat: no-repeat;
    transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
    will-change: transform;
    mask: linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 85%, rgba(0,0,0,0) 100%);
    -webkit-mask: linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 85%, rgba(0,0,0,0) 100%);
  }

  .abstract-graphics:hover .background-layer {
    transform: 
      translateX(calc(var(--mouse-x) * -8px)) 
      translateY(calc(var(--mouse-y) * -6px)) 
      scale(1.02);
  }

  /* Parallax overlay layers for depth */
  .parallax-layer {
    position: absolute;
    width: 100%;
    height: 100%;
    pointer-events: none;
    opacity: 0.1;
    background: radial-gradient(
      circle at center, 
      rgba(90, 159, 212, 0.3) 0%, 
      transparent 60%
    );
  }

  .layer-1 {
    background-size: 200px 200px;
    animation: float 20s infinite ease-in-out;
    transform: translateX(calc(var(--mouse-x) * 12px)) translateY(calc(var(--mouse-y) * 8px));
  }

  .layer-2 {
    background-size: 150px 150px;
    animation: float 25s infinite ease-in-out reverse;
    transform: translateX(calc(var(--mouse-x) * -10px)) translateY(calc(var(--mouse-y) * 6px));
  }

  .layer-3 {
    background-size: 100px 100px;
    animation: float 30s infinite ease-in-out;
    transform: translateX(calc(var(--mouse-x) * 15px)) translateY(calc(var(--mouse-y) * -10px));
  }

  /* Interactive icon areas */
  .interactive-areas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 10;
  }

  .icon-area {
    position: absolute;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    transform-origin: center;
    will-change: transform;
  }

  .icon-area:hover {
    transform: 
      scale(1.1) 
      translateX(calc(var(--mouse-x) * 8px)) 
      translateY(calc(var(--mouse-y) * 6px));
  }

  .icon-area:focus {
    outline: 2px solid rgba(90, 159, 212, 0.6);
    outline-offset: 4px;
  }

  /* Icon highlight effect */
  .icon-highlight {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: radial-gradient(
      circle at center,
      rgba(255, 255, 255, 0.3) 0%,
      rgba(90, 159, 212, 0.2) 50%,
      transparent 100%
    );
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .icon-area:hover .icon-highlight {
    opacity: 1;
  }

  /* Ripple effect on hover */
  .icon-ripple {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border-radius: 50%;
    background: rgba(90, 159, 212, 0.4);
    transform: translate(-50%, -50%);
    transition: all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  .icon-area.hovered .icon-ripple {
    width: 120%;
    height: 120%;
    opacity: 0;
  }

  /* Floating ambient particles */
  .floating-particles {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 5;
  }

  .particle {
    position: absolute;
    width: 4px;
    height: 4px;
    background: rgba(90, 159, 212, 0.6);
    border-radius: 50%;
    filter: blur(1px);
  }

  .particle-1 {
    top: 20%;
    left: 15%;
    animation: floatParticle 15s infinite ease-in-out;
  }

  .particle-2 {
    top: 30%;
    right: 20%;
    animation: floatParticle 18s infinite ease-in-out reverse;
    animation-delay: -3s;
  }

  .particle-3 {
    bottom: 40%;
    left: 25%;
    animation: floatParticle 20s infinite ease-in-out;
    animation-delay: -6s;
  }

  .particle-4 {
    top: 60%;
    right: 15%;
    animation: floatParticle 22s infinite ease-in-out reverse;
    animation-delay: -9s;
  }

  .particle-5 {
    bottom: 20%;
    left: 60%;
    animation: floatParticle 17s infinite ease-in-out;
    animation-delay: -12s;
  }

  .particle-6 {
    top: 15%;
    left: 70%;
    animation: floatParticle 19s infinite ease-in-out reverse;
    animation-delay: -15s;
  }

  /* Tooltip for hovered icons */
  .icon-tooltip {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(30, 58, 95, 0.9);
    color: white;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    z-index: 20;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(8px);
    animation: tooltipFadeIn 0.3s ease;
  }

  .icon-tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: rgba(30, 58, 95, 0.9);
  }

  /* Animations */
  @keyframes float {
    0%, 100% {
      transform: translateY(0px) rotate(0deg);
    }
    33% {
      transform: translateY(-20px) rotate(120deg);
    }
    66% {
      transform: translateY(10px) rotate(240deg);
    }
  }

  @keyframes floatParticle {
    0%, 100% {
      transform: translateY(0px) translateX(0px);
      opacity: 0.3;
    }
    25% {
      transform: translateY(-15px) translateX(10px);
      opacity: 0.8;
    }
    50% {
      transform: translateY(-5px) translateX(-8px);
      opacity: 0.5;
    }
    75% {
      transform: translateY(-20px) translateX(15px);
      opacity: 0.7;
    }
  }

  @keyframes tooltipFadeIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-5px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  @keyframes fadeInScale {
    from {
      opacity: 0;
      transform: scale(0.98);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .abstract-graphics {
    animation: fadeInScale 1s cubic-bezier(0.23, 1, 0.32, 1) forwards;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .abstract-graphics {
      height: 340px;
      border-radius: 16px;
    }

    .background-layer {
      background-size: 130% auto;
      background-position: center -40px;
    }

    .abstract-graphics:hover .background-layer {
      transform: 
        translateX(calc(var(--mouse-x) * -6px)) 
        translateY(calc(var(--mouse-y) * -4px)) 
        scale(1.01);
    }

    .icon-area:hover {
      transform: 
        scale(1.08) 
        translateX(calc(var(--mouse-x) * 6px)) 
        translateY(calc(var(--mouse-y) * 4px));
    }

    .layer-1 {
      transform: translateX(calc(var(--mouse-x) * 8px)) translateY(calc(var(--mouse-y) * 6px));
    }

    .layer-2 {
      transform: translateX(calc(var(--mouse-x) * -6px)) translateY(calc(var(--mouse-y) * 4px));
    }

    .layer-3 {
      transform: translateX(calc(var(--mouse-x) * 10px)) translateY(calc(var(--mouse-y) * -6px));
    }
  }

  @media (max-width: 480px) {
    .abstract-graphics {
      height: 280px;
      border-radius: 12px;
      cursor: default;
    }

    .background-layer {
      background-size: 140% auto;
      background-position: center -30px;
    }

    .abstract-graphics:hover .background-layer {
      transform: 
        translateX(calc(var(--mouse-x) * -3px)) 
        translateY(calc(var(--mouse-y) * -2px)) 
        scale(1.005);
    }

    .icon-area:hover {
      transform: 
        scale(1.05) 
        translateX(calc(var(--mouse-x) * 3px)) 
        translateY(calc(var(--mouse-y) * 2px));
    }

    .layer-1 {
      transform: translateX(calc(var(--mouse-x) * 4px)) translateY(calc(var(--mouse-y) * 3px));
    }

    .layer-2 {
      transform: translateX(calc(var(--mouse-x) * -3px)) translateY(calc(var(--mouse-y) * 2px));
    }

    .layer-3 {
      transform: translateX(calc(var(--mouse-x) * 5px)) translateY(calc(var(--mouse-y) * -3px));
    }

    .icon-tooltip {
      font-size: 12px;
      padding: 6px 12px;
    }
  }

  /* Disable parallax on touch devices */
  @media (hover: none) and (pointer: coarse) {
    .abstract-graphics:hover .background-layer,
    .icon-area:hover {
      transform: none;
    }

    .layer-1,
    .layer-2,
    .layer-3 {
      transform: none;
    }

    .abstract-graphics {
      cursor: default;
    }
  }

  /* Reduced motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .abstract-graphics,
    .background-layer,
    .icon-area,
    .icon-highlight,
    .icon-ripple,
    .particle {
      animation: none;
      transition: none;
    }

    .abstract-graphics:hover .background-layer,
    .icon-area:hover {
      transform: none;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .background-layer {
      filter: contrast(1.2) brightness(1.1);
    }

    .icon-highlight {
      background: radial-gradient(
        circle at center,
        rgba(0, 0, 0, 0.3) 0%,
        rgba(0, 0, 0, 0.1) 50%,
        transparent 100%
      );
    }

    .icon-tooltip {
      background: rgba(0, 0, 0, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
  }
</style>