# Changelog

## [1.1.0](https://github.com/allenhutchison/gemini-utils/compare/v1.0.0...v1.1.0) (2026-06-26)


### Features

* **transcription:** migrate audio transcription to the Interactions API ([c9e8bc4](https://github.com/allenhutchison/gemini-utils/commit/c9e8bc4185b85133795dc92cae07a9f182759855))
* **transcription:** surface Interactions API migration as 1.1.0 ([989b9d2](https://github.com/allenhutchison/gemini-utils/commit/989b9d248351f382e4787f24a2663524b4657936))


### Bug Fixes

* **transcription:** run interactions synchronously with background: false ([814bf87](https://github.com/allenhutchison/gemini-utils/commit/814bf87d72ff9a255eba285fcbc6f1c7e264e3f3))

## [1.0.0](https://github.com/allenhutchison/gemini-utils/compare/v0.6.0...v1.0.0) (2026-05-13)


### ⚠ BREAKING CHANGES

* requires @google/genai >= 2.0.0. Consumers reading `InteractionOutput[]` from a research interaction should now call `extractOutputs(interaction)` instead of `interaction.outputs`.

### Features

* upgrade @google/genai to 2.x ([a8629da](https://github.com/allenhutchison/gemini-utils/commit/a8629dacb5a8342e492485e168ea1cd3a8669f98))


### Bug Fixes

* **cli:** always write report file when --output is set ([d795f75](https://github.com/allenhutchison/gemini-utils/commit/d795f75c6add967159b774d4029ad49dc1feaa27))

## [0.7.0](https://github.com/allenhutchison/gemini-utils/compare/v0.6.0...v0.7.0) (2026-05-12)


### ⚠ BREAKING CHANGES

* require `@google/genai` >= 2.0.0. The Interactions API response shape changed in v2: `Interaction.outputs` was removed; output content now lives in `Interaction.steps[]` (filtered to `ModelOutputStep.content[]`). Use the new `extractOutputs(interaction)` helper from `@allenhutchison/gemini-utils/research` to read text/image/audio content out of an interaction.


### Features

* upgrade `@google/genai` peer dependency from 1.x to 2.x
* add `extractOutputs(interaction)` helper that flattens `interaction.steps` into the v1-equivalent `InteractionOutput[]`
* add `'incomplete'` to `InteractionStatus` and `TERMINAL_STATUSES` (introduced by SDK v2)


### Bug Fixes

* drop now-unnecessary `interactions.create` type-assertion workaround in `FileSearchManager.queryStore` (v2 types this surface natively)

## [0.6.0](https://github.com/allenhutchison/gemini-utils/compare/v0.5.0...v0.6.0) (2026-05-03)


### Features

* add MIME type probe script for discovering Gemini API support ([db5bdd2](https://github.com/allenhutchison/gemini-utils/commit/db5bdd2312fe278852e8f9dc2339a57b916e33ac))
* add MIME type support registry ([8f1456f](https://github.com/allenhutchison/gemini-utils/commit/8f1456f8ba286a378e92d0f3a0cb215a4d25a967))
* add MIME type support registry with queryable API and automated probing ([b188aad](https://github.com/allenhutchison/gemini-utils/commit/b188aad745520093ced0afe7730726b7c1368e7e))
* **research:** support next-generation Gemini Deep Research agents ([3ee3ada](https://github.com/allenhutchison/gemini-utils/commit/3ee3adabc5a05274ee81c9241e5bf25e36e52315)), closes [#28](https://github.com/allenhutchison/gemini-utils/issues/28)


### Bug Fixes

* address code review feedback ([db7fd14](https://github.com/allenhutchison/gemini-utils/commit/db7fd1486f63873141b8e54e0f7f1e5fef72e0e0))
* **deps:** Downgrade eslint to 9.39.2 ([af8664a](https://github.com/allenhutchison/gemini-utils/commit/af8664a94b5ab40d1552ea446acdaff44a051b72))
* explicitly disable Vertex AI routing in GoogleGenAI client to ensure interactions API support. ([888d129](https://github.com/allenhutchison/gemini-utils/commit/888d12915bc41844a02ba38e51d93f881a6b1be5))
* trim category values in probe CLI argument parsing ([40a29b9](https://github.com/allenhutchison/gemini-utils/commit/40a29b95acbe2a12d245b0d549246ba7aea2d3e2))
* unpin eslint and @eslint/js to use semver ranges ([fd3de34](https://github.com/allenhutchison/gemini-utils/commit/fd3de34f070400b53f62461859767422a206f54a))
* use correct TSV MIME type and import shared ErrorClass ([8b959c3](https://github.com/allenhutchison/gemini-utils/commit/8b959c3174c9d1b7c43f5606ec2d4048d042f481))
* use gemini-3-flash-preview as default model in probe script ([738a5a3](https://github.com/allenhutchison/gemini-utils/commit/738a5a3e942bc910ea9831c07b2854b25cfb9ebb))
* use gemini-3-flash-preview as default model in probe workflow ([9b386ad](https://github.com/allenhutchison/gemini-utils/commit/9b386ad160470a78095c2b46681562c1b79a430f))
