# Goal: Importing clients & patients from a PDF into the Vetspire API

You're going to help me write a script which migrates a veterinary clinic's data from a PDF report into their new SaaS provider _VetSpire_'s GraphQL API. 

- Patients are pets, clients are their owners. 
- Once we ingest that PDF and turn it into a clean CSV intermediate format, we'll then use the Vetspire API to create the relevant resources.
- VetSpire API documentation can be found here: https://developer.vetspire.com/
- We should try to enrich the data as much as possible. I'll pull together a list of fields that can possibly be included in the export, please match them against fields that can be provided through VetSpire's GraphQL API.
- While we might eventually consider importing visit records, for now, we'll just focus on importing the set of clients and patients.

The PDF includes each patient-client pair in blocks that are separated by a couple lines. Each block includes a collection of labeled fields -- labels italicized, values regular.

We'll complete this task in a few phases:

1. Write some Typescript which successfully parses the PDF into an array of keyed objects. 
    - Run it with tsx
    - Set up a basic tsconfig which disallows implicit any and enforces strict null checks
    - Define an interface based on what you can find in the PDF
2. Add a data cleaning step into our script, converting inputs to have all the desired fields for our API. 
    - In particular, we have a field `patientSexSpay` which really holds two different values for our API.
        - The field has two characters, the capital letters from Male or Female and Intact or Spayed. So a value of MI means a male who hasn't been spayed, a value of FS means a female who has been. 
        - I'd like our array of keyed objects to have separate `patientSex` and `patientSpayed` values, where the latter is a boolean.
    - For deceased, the `patientStatus` field will say either "Deceased" or "N/A - D". We'll want `patientDeceased` to be a boolean in our keyed object
        - Patient status is stored as a code which is a little less legible, but I know that the majority of patients have the status "Home", and that code is H. From the user's perspective, the full status list is: Home, Appointment, Boarding, Deceased, Exam 1, Exam 3, Hospitalized, ICU, In Process, Isolation, Lobby, N/A, N/A - D, New, Release, Surgery, Waiting Room
    - A client who no longer has any active pets with the vet, their status will be marked as inactive.
3. Write a VetSpire GraphQL API client.
    - Download the documentation to refresh your memory: https://developer.vetspire.com/
    - Based on our stated goals, import the documentation and create Typescript types for all of the relevant GraphQL resources, entities, API calls, etc.
    - Figure out a reusable request function which correctly manages authentication. Use .env files to manage secret keys, I'll plug mine in.
    - Using the generic request function, write helper functions for each of the operations we care about: 
        - Looking up clients by email to see if a record already exists.
        - Creating/update clients & patients. 
        - You should also add a helper method for marking a patient as inactive, as that'll help us clean up intermediate runs while we test everything out.
4. Write the full import script. For each client-patient pair, you'll:
    - Check whether a client already exists with the given email. If yes, check whether they have an associated patient with the given name. If the patient or client are missing, follow the steps below for creating a client. 
    - Create a client and then create a patient on it. 
        - The client will get a new ID from the system, we should store that in an output JSON named `import_results`. 
        - That JSON should include one keyed object per client-patient pair, where that object has two keys, "client" and "patient". Even if a client already existed and we only had to create a patient, both objects should be included here.
        - Each of those should include the full resource we produced, including every field that the GraphQL API will give us. If there's more than one pet for the same client, then update the existing { client: Client, patient: Patient } object to instead be { client: Client, patients: Patient[] }
        - If we find that one client has more than one patient associated with them
    - Output a log for each pair created, not too verbose, something like "Created a [dog] named [Vince], owned by [Jane] [Doe] since [patientDOB]". If this is an additional pet for an existing client, add a tag "(pet #n)", where n is the new length of the patients array.
    - Give the script a CLI param to limit how many pets we attempt to import.
5. Run the import script for a limited chunk of the CSV against their test clinic, that way we make sure everything behaves. I'll have the Vetspire dashboard open and can make comments on how to adjust.


Additional requirements:
- Always ask for my permission before making code changes, unless I explicitly state otherwise.
- Write basic integration tests to evaluate whether the overall system is behaving. Don't worry about exact unit tests, I can debug myself to figure out which part is broken. The goal is being able to easily check whether things are working by calling npm run test.
- All of my functionality should be triggerable from a terminal command, all outputs should be saved in the outputs directory and named such that they sort chronologically.
- Prefer DRY code which reuses more generic functions, even if repeating yourself would be more "explicit".
- Never use Typescript's `any`. Use unknown, parsers, and type guards to maintain type safety throughout runtime.
- Use a library to parse CLI arguments, something like yargs, to help keep the code well-organized. I like the following code organization concepts:
    - "commands" group the interface functions that my program exposes to callers
    - "services" group together the business logic code implementing this interface, generally encapsulating chunks of our system. For example, we might have one service which handles CSV operations.
    - "clients" group together "adapter" functions for our third parties, providing a cleaner interface for our business logic. I expect we'll have 2 clients, pdfClient & vetspireClient, and the vetspireClient will export helper functions like `getUserByEmail(email:string)`.
- When we've established a good threshold for working functionality, commit to git.