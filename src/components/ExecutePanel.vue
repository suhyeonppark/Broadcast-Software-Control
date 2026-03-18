<template>
  <div class="panel-block execute-block">
    <div class="section-label">실행</div>
    <div class="control-panel execute-panel">
      <div class="cut-auto-row">
        <button class="btn-hw" @click="$emit('cut')">CUT</button>
        <button class="btn-hw" @click="$emit('auto')">AUTO</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineEmits(['cut', 'auto']);
</script>

<style scoped>
.control-panel {
  background: var(--soft-panel-bg);
  border: 1px solid var(--soft-panel-border);
  border-radius: 12px;
  width: 600px;
}

.execute-panel { padding: 22px 26px; }

.cut-auto-row {
  display: flex;
  gap: 18px;
}

.cut-auto-row .btn-hw {
  flex: 1;
  width: auto;
  height: 260px;
  background: #555;
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.12s ease, transform 0.08s ease;
}
.cut-auto-row .btn-hw:hover { filter: brightness(1.2); }
.cut-auto-row .btn-hw:active { transform: scale(0.98); }

</style>
