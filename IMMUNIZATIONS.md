I'm solving one more problem with this CLI. My friend the veterinarian also needs to import the records of immunizations that were previously delivered to her or the patients she's inherited: the pets. Similar to before, there are two halves to the problem.

1. We need to parse a messy PDF report containing input data.
2. We need to create the actual records using a GraphQL method inside of our API client.
   The distinction is that now the report is much messier as I wasn't able to control its output. Other than that, it is largely similar; we're just adding implementing a new resource.

More details on the problem are below. Please digest these instructions, review all of the reference data, then lay out a plan for how you'll implement. For the absolutely critical pieces of logic, show me your proposed code.

### Input PDF

- Input PDF: vaccine_export.pdf

- Our input PDF contains a list of vaccination deliveries, grouped by vaccine lot. Each delivery line includes the name of the pet (patient) and their owner (client). However, they don't include the legacy IDs which would let me make a direct comparison against the records we have on the server. When I add a new method to the importer service to complete this, I'm going to want to load up the set of all currently known patients along with their clients and make a lookup object which is keyed by `${patient.name}_(${client.familyName}, ${client.givenName})`. This will allow us to easily check as we process a new row whether we'll successfully import the patient and client associated.

- The input data on our PDF has a somewhat odd structure. As I create each immunization I'm going to need to use I'm going to combine the lot number, manufacturer, and expiration data with the per delivery data (which patient, which client, what vaccine it was). It has a page header typical to a printout report and then has a list of grouped vaccine deliveries where the deliveries are grouped by a lot. So you'll have:
  - Divider bar
  - Lot number, manufacturer, expiration date.
  - Header row that has the date, patient, client, description
  - Series of deliveries
  - "Total number of vaccinations given for this period and lot # -> N"

### New GraphQL resource

- GraphQL API Refs:

  - Immunization object https://developer.vetspire.com/object/Immunization
  - CreateImmunization mutation https://developer.vetspire.com/mutations/ClinicalMutations#createImmunization
  - ImmunizationInput https://developer.vetspire.com/input_object/ImmunizationInput

- There are a few fields here with specific enum values:
  - ImmunizationStatus: ACTIVE, COMPLETED, DECLINED, ENTERED_IN_ERROR, PENDING
  - ImmunizationType: BOOSTER, INITIAL
  - RouteType: DROPS, INJECTABLE, INTRAMUSCULAR, INTRANASAL, INTRAVENOUSLY, OINTMENT, ORAL, SUBCUTANEOUS, TOPICAL, TRANSDERMAL

### Transformation logic

- Going to the immunization input field, I'm going to call out the ones which we can give you some guidance on how to fill out.
  - Administered will always be true because we're describing vaccines that happened in the past.
  - Date will be the date given value from the CSV, due date will correspond to the date due value.
  - Declined will always be false.
  - doseQuantity and encounterId should be empty.
  - expiryDate should be based on the lot.
  - historical should be true.
  - immunizationStatus should be COMPLETED unless the date due is in the future, in which case it is a status can be ACTIVE.
  - If the description field mentions rabies, then isRabis is true.
  - Location ID will always be a real location from the environment.
  - Lot number will be specified in the data.
  - Manufacturer will be a string specified in the data.
  - Name we should use the description directly.
  - Patient ID we should derive through our look up.
  - Provider ID I'll give you a value through a new environment variable
  - Route should be SUBCUTANEOUS unless it matches one of these rules:
    - If the description mentions intranasal, then INTRANASAL
  - Site should always be "Unknown (Legacy)"
  - technicianID can be blank.
  - immunizationType should be INITIAL, unless the description includes a # or 2nd or 3rd, in which case it should be BOOSTER
