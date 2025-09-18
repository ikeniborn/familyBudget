<!--
Test Component for Warning Suppression Validation (v3.7.5)

This component is used to test that legitimate component warnings are NOT suppressed
by the SvelteKit warning suppression system. It should generate warnings for
unknown props that are NOT SvelteKit internal props.
-->

<script lang="ts">
  // This component intentionally accepts some known props
  // and will warn about unknown props when they are passed
  export let knownProp = 'default';
  export let anotherKnownProp = 42;
</script>

<div class="test-component">
  <h3>Test Component for Warning Validation</h3>
  <p>Known Prop: {knownProp}</p>
  <p>Another Known Prop: {anotherKnownProp}</p>

  <!-- This should NOT generate warnings -->
  <slot />
</div>

<style>
  .test-component {
    padding: 1rem;
    border: 2px dashed #ccc;
    margin: 1rem;
    background-color: #f9f9f9;
  }

  .test-component h3 {
    color: #333;
    margin-top: 0;
  }

  .test-component p {
    margin: 0.5rem 0;
  }
</style>