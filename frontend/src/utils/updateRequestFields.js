/** Shared helpers for Update Information request cancel/review UI. */

export const getChangedUpdateFields = (item) => {
  if (!item || item.requestType !== 'update_information') return [];
  const updateDetails = item.updateDetails || {};
  let list = [];
  if (Array.isArray(updateDetails.changes) && updateDetails.changes.length > 0) {
    list = updateDetails.changes;
  } else if (updateDetails.fieldToUpdate || updateDetails.currentValue || updateDetails.newValue) {
    list = [{
      field: updateDetails.fieldToUpdate || 'Update Field',
      currentValue: updateDetails.currentValue,
      newValue: updateDetails.newValue,
      reason: updateDetails.reason
    }];
  }

  return list.filter((change) => {
    const oldVal = String(change.currentValue ?? change.oldValue ?? '').trim();
    const newVal = String(change.newValue ?? '').trim();
    return oldVal !== newVal;
  }).map((change) => ({
    field: change.field || change.fieldToUpdate || 'Update Field',
    oldValue: String(change.currentValue ?? change.oldValue ?? '--').trim() || '--',
    newValue: String(change.newValue ?? '--').trim() || '--'
  }));
};
