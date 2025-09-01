<agent id="vetspire-import" version="1.0" updated="2025-09-01">
  <permissions requiresApproval="true" priority="high">
    Always ask for the user's permission before making code changes unless explicitly granted.
  </permissions>

  <reuse priority="high" enforce="true">
    Prefer reusing existing primitives and utilities; search the repository before adding new code.
  </reuse>

  <typescript priority="high" enforce="true">
    Never use `any`. Use `unknown`, schema parsers, or type guards for runtime validation of inputs and API responses.
  </typescript>

    <human_readability priority="med">
    Write code humans can maintain: prefer clear abstractions and DRY patterns over repeated, brittle conditionals.
    </human_readability>

    <fail_fast priority="high" enforce="true">
    Validate inputs early and fail with clear errors. Do not silently continue on invalid or missing required data.
    </fail_fast>

    <no_empty_placeholders priority="med" enforce="true">
    Avoid using empty placeholder values (e.g., "") for meaningful fields. If a required meaningful value is missing, fail or prompt rather than faking data.
    </no_empty_placeholders>

  <testing priority="med">
    Prefer E2E/integration tests for whole flows; write unit tests only for complex, black-box logic with no side effects. Ensure tests are runnable via npm scripts.
  </testing>

  <outputs priority="med" enforce="true">
    Save all run outputs to ./outputs. Use ISO-like timestamped filenames (e.g., client-patient-records_YYYY-MM-DDTHH-mm-ssZ.csv) so files sort chronologically.
  </outputs>

  <organization priority="med">
    Group code by responsibility:
    - commands: CLI entrypoints
    - services: business logic
    - clients: third-party adapters (e.g., pdfClient, vetspireClient)
  </organization>

  <cli priority="low">
    Use a CLI parsing library (for example, yargs) to organize commands and options, and to provide help text.
  </cli>

<dry_code priority="med">
Prefer DRY solutions that reuse generic functions; prefer a single correct abstraction over many near-duplicates.
</dry_code>

<commit_policy priority="low">
When functionality reaches an acceptable threshold of correctness and stability, commit to git.
</commit_policy>
</agent>
