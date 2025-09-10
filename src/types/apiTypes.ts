// API types - based on Vetspire GraphQL API documentation

// Base types and enums
export type ID = string;
export type Date = string;
export type DateTime = string;
export type NaiveDateTime = string;
export type Decimal = number;

export type Sex = 'MALE' | 'FEMALE' | 'UNKNOWN';
export type Pronouns = 'he/him' | 'she/her' | 'they/them' | 'other';
export type DiscountType = 'percentage' | 'fixed';

// Base entity interface with common fields
interface BaseEntity {
  id: ID;
  insertedAt?: NaiveDateTime;
  updatedAt?: NaiveDateTime;
}

// Utility types
export type RequireKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

// Shared input structures
export interface AddressInput {
  line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface Address extends AddressInput {
  id: ID;
}

export interface PhoneNumberInput {
  value?: string;
}

export interface PhoneNumber extends PhoneNumberInput {
  id: ID;
}

export interface PaymentSourceInput {
  // Payment source fields would be defined here
}

export interface PaymentSource extends PaymentSourceInput {
  id: ID;
}

// CLIENT TYPES
export interface ClientBase {
  name?: string;
  givenName?: string;
  familyName?: string;
  email?: string;
  secondaryEmail?: string;
  businessName?: string;
  dateOfBirth?: Date;
  title?: string;
  notes?: string;
  privateNotes?: string;
  pronouns?: Pronouns;
  pronounsOther?: string;
  historicalId?: string;
  mergeIdentification?: string;
  identification?: string;
  billingId?: string;
  isActive?: boolean;
  isMerged?: boolean;
  taxExempt?: boolean;
  stopReminders?: boolean;
  declineEmail?: boolean;
  declinePhone?: boolean;
  declineRdvm?: boolean;
  declineSecondaryEmail?: boolean;
  addresses?: Address[];
  phoneNumbers?: PhoneNumber[];
  preferredPhoneNumber?: PhoneNumber;
  customReferralSource?: string;
  stripeCustomerId?: string;
  stripeInfo?: PaymentSource;
  cardconnectToken?: string;
  cardconnectTokenLast4?: string;
  cardconnectExpiry?: string;
  squareCardId?: string;
}

export interface Client extends BaseEntity, ClientBase {
  orgId?: ID;
  verifiedAt?: DateTime;
  emailVerifiedDate?: NaiveDateTime;
  secondaryEmailVerifiedDate?: NaiveDateTime;
  sentEmailVerificationDate?: NaiveDateTime;
  sentSecondaryEmailVerificationDate?: NaiveDateTime;
  lastSyncedAt?: NaiveDateTime;
  accountCredit?: Decimal;
  lifetimeValue?: Decimal;
  trailingYearValue?: Decimal;
  paymentCount?: number;
  primaryLocationId?: ID;
  clientReferralSourceId?: ID;
  patients?: Patient[];
}

export interface ClientInput extends Omit<ClientBase, 'addresses' | 'phoneNumbers' | 'stripeInfo'> {
  addresses?: AddressInput[];
  phoneNumbers?: PhoneNumberInput[];
  stripeInfo?: PaymentSourceInput;
  clientReferralSourceId?: ID;
  primaryLocationId?: ID;
  emailVerifiedDate?: NaiveDateTime;
  secondaryEmailVerifiedDate?: NaiveDateTime;
  sentEmailVerificationDate?: NaiveDateTime;
  sentSecondaryEmailVerificationDate?: NaiveDateTime;
  lastSyncedAt?: NaiveDateTime;
  verifiedAt?: DateTime;
  rdvmIds?: ID[];
  tags?: ID[];
  updateNote?: string;
}

// PATIENT TYPES
export interface PatientBase {
  name?: string;
  species?: string;
  breed?: string;
  sex?: Sex;
  sexTerm?: string;
  birthDate?: Date;
  birthYear?: number;
  birthMonth?: number;
  birthDay?: number;
  age?: string;
  isEstimatedAge?: boolean;
  microchip?: string;
  microchipRegistered?: boolean;
  neutered?: boolean;
  neuterDate?: Date;
  isDeceased?: boolean;
  deceasedDate?: Date;
  goalWeight?: string;
  latestWeight?: string;
  isEstimatedWeight?: boolean;
  profileImageUrl?: string;
}

export interface Patient extends BaseEntity, PatientBase {
  clientId?: ID;
  client?: Client;
  verifiedAt?: DateTime;
  lastSyncedAt?: NaiveDateTime;
  historicalId?: string;
  primaryLocationId?: ID;
}

export interface PatientInput extends PatientBase {
  color?: string;
  firstHeatDate?: Date;
  hisa?: string;
  hisaRegistered?: boolean;
  historicalId?: string;
  primaryLocationId?: ID;
  identification?: string;
  isActive?: boolean;
  isDnr?: boolean;
  isMixed?: boolean;
  lastSyncedAt?: NaiveDateTime;
  privateNotes?: string;
  preferredWeightUnit?: string;
  subscriptions?: string[];
  tagIds?: ID[];
  verifiedAt?: DateTime;
  vitals?: any[]; // VitalsInput type would need definition
  alerts?: string[];
}

// CLIENT TAG TYPES
export interface ClientTagBase {
  name?: string;
  discount?: Decimal;
  discountType?: DiscountType;
  priority?: number;
}

export interface ClientTag extends BaseEntity, ClientTagBase {
  // Relations are typically not included in the base type
}

export interface ClientTagInput extends ClientTagBase {
  couponIds?: ID[];
  locationIds?: ID[];
}

// PATIENT TAG TYPES (inferred structure)
export interface PatientTag extends BaseEntity {
  name?: string;
  // Additional patient tag fields would be defined here
}

export interface PatientTagInput {
  name?: string;
  // Additional patient tag input fields would be defined here
}

// QUERY PARAMETER TYPES
export interface PatientFilters {
  // Patient filtering options
}

export interface ClientFilters {
  // Client filtering options
}

export interface SortOptions {
  field?: string;
  direction?: 'asc' | 'desc';
}

export enum PatientOrderByEnum {
  ID = 'id',
  NAME = 'name',
  SPECIES = 'species'
}

// QUERY TYPES
export interface PatientQuery {
  id: ID;
}

export interface PatientsQuery {
  filters?: PatientFilters;
  limit?: number;
  offset?: number;
  orderBy?: PatientOrderByEnum;
  updatedAtStart?: NaiveDateTime;
  updatedAtEnd?: NaiveDateTime;
}

export interface PatientTagsQuery {
  updatedAtStart?: NaiveDateTime;
  updatedAtEnd?: NaiveDateTime;
}

export interface ClientQuery {
  id: ID;
}

export interface ClientsQuery {
  filters?: ClientFilters;
  insertedAtStart?: NaiveDateTime;
  insertedAtEnd?: NaiveDateTime;
  limit?: number;
  offset?: number;
  sortBy?: SortOptions;
  updatedAtStart?: NaiveDateTime;
  updatedAtEnd?: NaiveDateTime;
}

export interface ClientTagQuery {
  id: ID;
}

// IMMUNIZATION TYPES
export type ImmunizationStatus = 'ACTIVE' | 'COMPLETED' | 'DECLINED' | 'ENTERED_IN_ERROR' | 'PENDING';
export type ImmunizationType = 'BOOSTER' | 'INITIAL';
export type RouteType =
  | 'DROPS' | 'INJECTABLE' | 'INTRAMUSCULAR' | 'INTRANASAL' | 'INTRAVENOUSLY'
  | 'OINTMENT' | 'ORAL' | 'SUBCUTANEOUS' | 'TOPICAL' | 'TRANSDERMAL';

export interface ImmunizationInput {
  administered?: boolean;
  date?: Date;
  dueDate?: Date;
  declined?: boolean;
  doseQuantity?: string;
  encounterId?: ID;
  expiryDate?: Date;
  historical?: boolean;
  immunizationStatus?: ImmunizationStatus;
  isRabies?: boolean;
  location?: ID;
  lotNumber?: string;
  manufacturer?: string;
  name?: string;
  patient?: ID;
  provider?: ID;
  route?: RouteType;
  site?: string;
  technicianId?: ID;
  type?: ImmunizationType;
}

// Stronger draft type used by our importer for creation
export type ImmunizationDraft = RequireKeys<
  ImmunizationInput,
  | 'administered'
  | 'date'
  | 'declined'
  | 'expiryDate'
  | 'historical'
  | 'immunizationStatus'
  | 'isRabies'
  | 'lotNumber'
  | 'manufacturer'
  | 'name'
  | 'patient'
  | 'route'
  | 'site'
  | 'type'
>;

export interface Immunization extends BaseEntity {
  name?: string;
  patientId?: ID;
  date?: Date;
  dueDate?: Date;
  administered?: boolean;
  declined?: boolean;
  historical?: boolean;
  immunizationStatus?: ImmunizationStatus;
  immunizationType?: ImmunizationType;
  route?: RouteType;
  site?: string;
  lotNumber?: string;
  manufacturer?: string;
  expiryDate?: Date;
  isRabies?: boolean;
  locationId?: ID;
  providerId?: ID;
}

export interface ImmunizationResponse {
  createImmunization: Immunization;
}

// MUTATION RESPONSE TYPES
export interface CreateClientMutation {
  input: ClientInput;
}

export interface UpdateClientMutation {
  id: ID;
  input: ClientInput;
}

export interface CreatePatientMutation {
  clientId: ID;
  input: PatientInput;
}

export interface UpdatePatientMutation {
  id: ID;
  input: PatientInput;
}

export interface CreateClientTagMutation {
  input: ClientTagInput;
}

export interface CreatePatientTagMutation {
  input: PatientTagInput;
}

// Legacy compatibility types
export interface ClientResponse {
  createClient: Pick<Client, 'id' | 'givenName' | 'familyName'>;
}

export interface PatientResponse {
  createPatient: Pick<Patient, 'id' | 'name' | 'species'>;
}
