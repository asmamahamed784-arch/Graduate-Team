export const CORRECTION_REASON_CATALOG = [
  {
    code: 'FIRST_NAME_INCORRECT',
    reasonName: 'First name is incorrect',
    fieldName: 'firstName',
    category: 'Personal Information'
  },
  {
    code: 'MIDDLE_NAME_INCORRECT',
    reasonName: 'Middle name is incorrect',
    fieldName: 'middleName',
    category: 'Personal Information'
  },
  {
    code: 'LAST_NAME_INCORRECT',
    reasonName: 'Last name is incorrect',
    fieldName: 'lastName',
    category: 'Personal Information'
  },
  {
    code: 'FULL_NAME_INCOMPLETE',
    reasonName: 'Full name is incomplete',
    fieldName: 'fullName',
    category: 'Personal Information'
  },
  {
    code: 'FULL_NAME_DOCUMENT_MISMATCH',
    reasonName: 'Full name does not match the uploaded document',
    fieldName: 'fullName',
    category: 'Personal Information'
  },
  {
    code: 'MOTHER_NAME_INCORRECT',
    reasonName: "Mother's name is incorrect",
    fieldName: 'motherName',
    category: 'Personal Information'
  },
  {
    code: 'MOTHER_NAME_INCOMPLETE',
    reasonName: "Mother's name is incomplete",
    fieldName: 'motherName',
    category: 'Personal Information'
  },
  {
    code: 'DATE_OF_BIRTH_INCORRECT',
    reasonName: 'Date of birth is incorrect',
    fieldName: 'dateOfBirth',
    category: 'Personal Information'
  },
  {
    code: 'DATE_OF_BIRTH_FORMAT_INVALID',
    reasonName: 'Date of birth format is invalid',
    fieldName: 'dateOfBirth',
    category: 'Personal Information'
  },
  {
    code: 'DATE_OF_BIRTH_DOCUMENT_MISMATCH',
    reasonName: 'Date of birth does not match the document',
    fieldName: 'dateOfBirth',
    category: 'Personal Information'
  },
  {
    code: 'PLACE_OF_BIRTH_INCORRECT',
    reasonName: 'Place of birth is incorrect',
    fieldName: 'placeOfBirth',
    category: 'Personal Information'
  },
  {
    code: 'GENDER_INCORRECT',
    reasonName: 'Gender is incorrect',
    fieldName: 'gender',
    category: 'Personal Information'
  },
  {
    code: 'MARITAL_STATUS_INCORRECT',
    reasonName: 'Marital status is incorrect',
    fieldName: 'maritalStatus',
    category: 'Personal Information'
  },
  {
    code: 'PHONE_NUMBER_INCORRECT',
    reasonName: 'Phone number is incorrect',
    fieldName: 'phone',
    category: 'Personal Information'
  },
  {
    code: 'PHONE_NUMBER_FORMAT_INVALID',
    reasonName: 'Phone number format is invalid',
    fieldName: 'phone',
    category: 'Personal Information'
  },
  {
    code: 'DISTRICT_INCORRECT',
    reasonName: 'District is incorrect',
    fieldName: 'district',
    category: 'Personal Information'
  },
  {
    code: 'ADDRESS_INCOMPLETE',
    reasonName: 'Address is incomplete',
    fieldName: 'address',
    category: 'Personal Information'
  },
  {
    code: 'OCCUPATION_INCORRECT',
    reasonName: 'Occupation information is incorrect',
    fieldName: 'occupation',
    category: 'Personal Information'
  },
  {
    code: 'REQUIRED_DOCUMENT_MISSING',
    reasonName: 'Required document is missing',
    fieldName: 'documents',
    category: 'Document Problems'
  },
  {
    code: 'UPLOADED_DOCUMENT_INVALID',
    reasonName: 'Uploaded document is invalid',
    fieldName: 'documents',
    category: 'Document Problems'
  },
  {
    code: 'UPLOADED_DOCUMENT_UNREADABLE',
    reasonName: 'Uploaded document is unreadable',
    fieldName: 'documents',
    category: 'Document Problems'
  },
  {
    code: 'UPLOADED_DOCUMENT_EXPIRED',
    reasonName: 'Uploaded document has expired',
    fieldName: 'documents',
    category: 'Document Problems'
  },
  {
    code: 'DOCUMENT_INFO_MISMATCH',
    reasonName: 'Document information does not match the citizen information',
    fieldName: 'documents',
    category: 'Document Problems'
  },
  {
    code: 'CITIZEN_PHOTO_UNCLEAR',
    reasonName: 'Citizen photo is unclear',
    fieldName: 'photo',
    category: 'Document Problems'
  },
  {
    code: 'CITIZEN_PHOTO_MISMATCH',
    reasonName: 'Citizen photo does not match the document',
    fieldName: 'photo',
    category: 'Document Problems'
  },
  {
    code: 'SUPPORTING_DOCUMENT_INCOMPLETE',
    reasonName: 'Supporting document is incomplete',
    fieldName: 'documents',
    category: 'Document Problems'
  },
  {
    code: 'DUPLICATE_REGISTRATION_DETECTED',
    reasonName: 'Duplicate registration detected',
    fieldName: 'registration',
    category: 'Registration Problems'
  },
  {
    code: 'CITIZEN_ALREADY_HAS_NATIONAL_ID',
    reasonName: 'Citizen already has a National ID',
    fieldName: 'registration',
    category: 'Registration Problems'
  },
  {
    code: 'EXISTING_RECORD_MISMATCH',
    reasonName: 'Information does not match an existing citizen record',
    fieldName: 'registration',
    category: 'Registration Problems'
  },
  {
    code: 'REQUIRED_INFORMATION_INCOMPLETE',
    reasonName: 'Required information is incomplete',
    fieldName: 'registration',
    category: 'Registration Problems'
  },
  {
    code: 'IDENTITY_VERIFICATION_FAILED',
    reasonName: 'Identity verification failed',
    fieldName: 'registration',
    category: 'Registration Problems'
  },
  {
    code: 'OTHER',
    reasonName: 'Other',
    fieldName: 'other',
    category: 'Registration Problems'
  }
];

export const CORRECTION_REASON_NAMES = CORRECTION_REASON_CATALOG.map((reason) => reason.reasonName);
