import type vi from '@/locales/vi/units';
import type { Messages } from '@/locales/messages';

const units: Messages<typeof vi> = {
  units: {
    page: {
      description: 'Units to pick when adding an item or writing an Other item.',
      add: 'Add unit',
      addTitle: 'Add unit',
      submitAdd: 'Add unit',
      editTitle: 'Edit unit',
      submitEdit: 'Save changes',
      name: 'Unit name',
      nameEn: 'English name',
      added: 'Added unit {{name}}',
      saved: 'Saved unit {{name}}',
      deleted: 'Deleted unit {{name}}',
      colName: 'Name',
      colNameEn: 'English name',
      colItems: 'Items using it',
      colActions: 'Actions',
      menu: 'Actions for {{name}}',
      edit: 'Edit',
      deactivate: 'Pause',
      inactive: 'Paused',
      deactivateTitle: 'Pause unit “{{name}}”?',
      deactivateBody: 'The unit is hidden from the picker when adding items and “Other item”. Old items and requests keep its name.',
      reactivate: 'Use again',
      reactivateTitle: 'Use unit “{{name}}” again?',
      reactivateBody: 'The unit shows in the picker again.',
      delete: 'Delete',
      deleteConfirm: 'Delete unit',
      deleteTitle: 'Delete unit “{{name}}”?',
      deleteBody: 'Only a unit no item or request uses can be deleted; this cannot be undone.',
      dirty: 'Order changed ({{n}} units)',
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
