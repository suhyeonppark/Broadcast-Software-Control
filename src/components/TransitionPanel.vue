<template>
  <div class="panel-block">
    <div class="section-label">트랜지션 유형</div>
    <div class="control-panel">
      <div class="trans-grid">
        <button
          v-for="t in transitions"
          :key="t"
          class="btn-action"
          :class="{ 'active-trans': active === t }"
          @click="$emit('select', t)"
        >{{ t }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  transitions: Array,
  active: String,
});
defineEmits(['select']);
</script>

<style scoped>
.control-panel {
  background: var(--soft-panel-bg);
  border: 1px solid var(--soft-panel-border);
  border-radius: 12px;
  padding: 22px 26px 26px;
  width: 600px;
}

.trans-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.btn-action {
  width: 100%;
  height: 62px;
  background: #444;
  border: none;
  color: white;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  font-size: 14px;
  transition: background-color 0.12s ease, transform 0.08s ease;
}
.btn-action:hover { filter: brightness(1.2); }
.btn-action:active { transform: scale(0.98); }

.active-trans {
  background-color: var(--active-yellow) !important;
  color: black;
}
</style>
