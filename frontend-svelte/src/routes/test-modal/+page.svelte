<script>
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let showModal1 = false;
  let openModal2 = false;
  let isOpenModal3 = false;

  function openModalWithShow() {
    console.log('Opening modal with show prop');
    showModal1 = true;
  }

  function openModalWithOpen() {
    console.log('Opening modal with open prop');
    openModal2 = true;
  }

  function openModalWithIsOpen() {
    console.log('Opening modal with isOpen prop');
    isOpenModal3 = true;
  }
</script>

<div class="p-8 space-y-4">
  <h1 class="text-2xl font-bold mb-6">Modal Test Page</h1>

  <div class="space-x-4">
    <Button on:click={openModalWithShow}>
      Test Modal with "show" prop
    </Button>

    <Button on:click={openModalWithOpen}>
      Test Modal with "open" prop
    </Button>

    <Button on:click={openModalWithIsOpen}>
      Test Modal with "isOpen" prop
    </Button>
  </div>

  <!-- Modal with show prop (articles page uses this) -->
  <Modal bind:show={showModal1} title="Test Modal with show">
    <div class="p-6">
      <p>This modal uses the "show" prop (like articles page)</p>
      <p>State: showModal1 = {showModal1}</p>
    </div>
    <div slot="footer" class="flex gap-2">
      <Button on:click={() => showModal1 = false}>Close</Button>
    </div>
  </Modal>

  <!-- Modal with open prop -->
  <Modal bind:open={openModal2} title="Test Modal with open">
    <div class="p-6">
      <p>This modal uses the "open" prop</p>
      <p>State: openModal2 = {openModal2}</p>
    </div>
    <div slot="footer" class="flex gap-2">
      <Button on:click={() => openModal2 = false}>Close</Button>
    </div>
  </Modal>

  <!-- Modal with isOpen prop -->
  <Modal bind:isOpen={isOpenModal3} title="Test Modal with isOpen">
    <div class="p-6">
      <p>This modal uses the "isOpen" prop</p>
      <p>State: isOpenModal3 = {isOpenModal3}</p>
    </div>
    <div slot="footer" class="flex gap-2">
      <Button on:click={() => isOpenModal3 = false}>Close</Button>
    </div>
  </Modal>
</div>