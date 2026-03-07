<script lang="ts">
  import { notifications } from '../stores/notifications';
</script>

<div class="notifications">
  {#each $notifications as notif (notif.id)}
    <div class="notification {notif.type}">
      {notif.message}
    </div>
  {/each}
</div>

<style>
  .notifications {
    position: fixed;
    top: 45px;
    right: 290px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 50;
    pointer-events: none;
    max-width: 320px;
  }

  .notification {
    padding: 0.4rem 0.7rem;
    border-radius: 3px;
    font-family: 'Crimson Text', serif;
    font-size: 0.8rem;
    border: 1px solid;
    animation: slideIn 0.2s ease-out;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .notification.info {
    background: #2a2a30;
    border-color: #5a7a8a;
    color: #c8d8e0;
  }

  .notification.warning {
    background: #3a3020;
    border-color: #b8964e;
    color: #f0e6d0;
  }

  .notification.danger {
    background: #3a2020;
    border-color: #a83a2a;
    color: #e0c0b0;
  }

  .notification.success {
    background: #2a3a20;
    border-color: #4a7a42;
    color: #c0e0b0;
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
</style>
