import type vi from '@/locales/vi/units';
import type { Messages } from '@/locales/messages';

const units: Messages<typeof vi> = {
  units: {
    page: {
      description: 'Units show in the picker when adding items and when staff write “Other item”. Retired units keep their name on old items and requests.',
      add: 'Add unit',
      addTitle: 'Add unit',
      submitAdd: 'Add unit',
      name: 'Unit name',
      nameEn: 'English name',
      added: 'Added unit {{name}}',
      saved: 'Saved unit {{name}}',
      deleted: 'Deleted unit {{name}}',
      colOrder: 'Order',
      colName: 'Name',
      colNameEn: 'English name',
      colItems: 'Items using it',
      colStatus: 'Status',
      colActive: 'In use',
      moveUp: 'Move {{name}} up',
      moveDown: 'Move {{name}} down',
      editName: 'Rename unit {{name}}',
      editNameEn: 'Edit English name of {{name}}',
      active: 'In use',
      inactive: 'Retired',
      deactivateLabel: 'Retire {{name}}',
      reactivateLabel: 'Reopen {{name}}',
      delete: 'Delete {{name}}',
      deleteConfirm: 'Delete unit',
      deleteTitle: 'Delete unit “{{name}}”?',
      deleteBody: 'Only a unit no item or request uses can be deleted; this cannot be undone.',
      dirty: 'Order changed ({{n}} units)',
      revert: 'Revert',
      saveOrder: 'Save order',
      saving: 'Saving…',
      orderSaved: 'Saved the order of {{n}} units',
      orderPartial: 'Order not fully saved ({{a}}/{{n}} units) — reloaded the current order.',
      empty: 'No units yet',
      emptyHint: 'Add the first unit to pick when adding items.',
    },
    errors: {
      UNIT_EXISTS: 'A unit with this name already exists.',
      UNIT_NOT_FOUND: 'This unit no longer exists — reload the page.',
      UNIT_IN_USE: 'This unit is in use — it can only be retired.',
      FIELD_INVALID: 'Check this value.',
      UNKNOWN: 'Could not save — try again in a few minutes.',
    },
  },
};

export default units;
