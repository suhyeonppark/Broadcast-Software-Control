<template>
  <div class="panel-block program-block">
    <div class="section-label">{{ label }}</div>
    <div class="bus-row">
      <button
        v-for="(ch, i) in channels"
        :key="i"
        class="btn-hw"
        :class="{ [activeClass]: activeIndex === i }"
        @click="$emit('select', i)"
      >{{ ch.label }}</button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  label: String,
  channels: Array,
  activeIndex: Number,
  activeClass: String,
});
defineEmits(['select']);
</script>

<style scoped>
.bus-row {
  display: grid;
  grid-template-columns: repeat(5, 170px);
  gap: 20px;
  background: var(--soft-panel-bg);
  border: 1px solid var(--soft-panel-border);
  border-radius: 12px;
  padding: 22px 30px;
  width: fit-content;
}

.btn-hw {
  width: 170px;
  height: 120px;
  background: var(--btn-gray);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.12s ease, transform 0.08s ease;
}
.btn-hw:hover { filter: brightness(1.2); }
.btn-hw:active { transform: scale(0.98); }

.active-pgm { background-color: var(--active-red) !important; color: white; }
.active-pvw { background-color: var(--active-lime) !important; color: black; }
</style>
