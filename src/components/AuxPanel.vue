<template>
  <div class="panel-block">
    <div class="section-label">AUX</div>
    <div class="control-panel">
      <div class="aux-source-grid">
        <button
          v-for="(src, i) in sources"
          :key="i"
          class="btn-aux"
          :class="{ 'active-aux': activeIndex === i }"
          @click="$emit('select', i)"
        >{{ src.label }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  sources: Array,
  activeIndex: Number,
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

.aux-source-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.btn-aux {
  min-height: 80px;
  padding: 20px 16px;
  background: #3f3f3f;
  border: none;
  color: white;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
  font-size: 18px;
  transition: background-color 0.12s ease, transform 0.08s ease;
}
.btn-aux:hover { filter: brightness(1.2); }
.btn-aux:active { transform: scale(0.98); }

.active-aux {
  background-color: #e8a023 !important;
  color: black;
}
</style>
