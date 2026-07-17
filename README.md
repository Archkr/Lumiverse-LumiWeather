# LumiWeather

LumiWeather is a Lumiverse extension that adds a draggable weather HUD and animated scene ambience to chat.

It is built for story-driven use, not live forecast data. The model controls the scene by emitting a hidden `<weather-state>` tag, and the extension turns that into HUD updates, layered effects, and per-chat weather state.

<img width="308" height="222" alt="Screenshot 2026-07-09 190232" src="https://github.com/user-attachments/assets/8097b4a4-c66e-4b5f-b450-12224de1850b" />
<img width="305" height="220" alt="image" src="https://github.com/user-attachments/assets/949c2401-265e-4e60-998e-59d13962453e" />


## Features

- Compact draggable HUD with dynamic styling based on story time, palette, and weather
- Animated ambience that can render behind the chat, in front of the chat, or both
- Story sync mode driven by hidden inline weather tags
- Manual lock mode for overriding the current scene per chat
- Per-chat persistence for story state and manual overrides
- Prompt macros for reliable prompt-side weather tag generation
- Clear waiting status when a chat has not emitted its first weather tag

## Prompt Setup

To make the main model emit weather tags consistently, add this to the active character or preset system prompt:

```text
{{weather_tracker}}
```

Optional reference macros:

```text
{{weather_state}}
{{weather_format}}
```

`{{weather_tracker}}` is the canonical integration macro. The older aliases remain available for existing prompts; the current state is injected directly into generation, so `{{weather_state}}` is retained only as a compatibility marker. LumiWeather no longer makes extra generation calls when a tag is missing.

Supported aliases:

- `{{weather_tracker}}`
- `{{story_weather_tracker}}`
- `{{story_weather}}`
- `{{weather_state}}`
- `{{story_weather_state}}`
- `{{weather_format}}`
- `{{story_weather_format}}`

The legacy `story_weather_*` aliases and technical extension ID remain in place so existing installs and prompts update cleanly under the LumiWeather name.

## Hidden Tag Contract

The assistant should keep all visible prose natural, then end the message with exactly one hidden weather tag:

```html
<weather-state location="Example Location" date="2026-01-15" time="3:00 PM" condition="rain" summary="Steady afternoon rain" temperature="60F" intensity="0.65" wind="breezy" windDirection="west" palette="storm"></weather-state>
```

Supported conditions:

- `clear`
- `cloudy`
- `rain`
- `storm`
- `snow`
- `fog`

Condition names are case-insensitive and common aliases such as `sunny`, `overcast`, `rainy`, `thunderstorm`, `snowy`, and `mist` are normalized to these six values. Dates must be real calendar dates, and times must be valid 12-hour or 24-hour values.

Effect placement is user-controlled in settings:

- Back only
- Front only
- Front and back

Supported palettes:

- `dawn`
- `day`
- `dusk`
- `night`
- `storm`
- `mist`
- `snow`

## How It Works

1. The prompt includes `{{weather_tracker}}`.
2. The model writes its normal reply, then appends one final `<weather-state>` tag.
3. The frontend hides the tag from visible chat.
4. The HUD updates only after the assistant message is complete, so streaming does not mutate the scene mid-reply.
5. The backend stores the normalized weather state per chat.
6. If the model does not emit a weather tag, the current scene remains unchanged and the HUD reports that it is waiting for LumiWeather.

Only completed assistant tags are accepted. Streaming tags and user-authored tags are ignored, and duplicate tags from the same chat message do not update state twice.

## Story Sync vs Manual Lock

### Story Sync

- Uses the AI-provided location, date, time, weather, and scene metadata
- Story time stays fixed to whatever the AI last set
- The scene only changes when the AI sends a new weather tag

### Manual Lock

- Lets you override the current scene for the active chat
- Keeps the override saved until you resume story sync
- The HUD clock can display live real time while manual mode is active

## Installation

1. Copy the repository URL:

```text
https://github.com/Archkr/Lumiverse-StoryWeather
```

2. In Lumiverse:

- Open the `Extensions` tab
- Click `Install`
- Paste the repo URL into the repo URL field
- Click `Install`

3. Enable the extension and grant `interceptor`, `chats`, and `ui_panels` permissions. LumiWeather does not request generation, message mutation, or app-manipulation permissions.

4. Open the extension settings panel and confirm the HUD/settings panel loaded correctly.

## Setup

To use story-driven weather generation:

1. Open the character or preset system prompt you want to use.
2. Add this line somewhere in the prompt:

```text
{{weather_tracker}}
```

3. Save the prompt.
4. Start or continue a chat.
5. The assistant should write its visible reply first, then append the hidden `<weather-state>` tag at the end of the message.

If you do not want the model driving the scene, you can skip prompt setup and use `Manual lock` from the HUD or settings panel instead.

On the home screen, the HUD intentionally shows an empty waiting state and effects remain off until a chat is active and that chat has emitted a weather tag.

## LumiState interoperability

LumiWeather publishes its normalized visible scene through the public, read-only `lumi_weather.state.current` endpoint. Compatible extensions receive the active chat ID, source-local revision, freshness, scene location, calendar date and time, and weather conditions with provenance.

Manual-lock and story-sync transitions both increase the per-chat revision. Returning to story sync also creates a new revision, even when the restored story state is older than the removed manual override.

`lumi_weather.contract.v1` describes the endpoint and LumiState v1 capability metadata. Publishing is an in-memory state update and never makes an additional generation call.

## Project Layout

```text
src/
  backend.ts      Backend state, macros, prompt interception, chat persistence
  frontend.ts     HUD, message interception, FX mounting, scene updates
  shared.ts       Normalization, defaults, parsing helpers
  lumi-state.ts   Public LumiState v1 snapshot mapping
  presets.ts      Quick scene presets
  types.ts        Shared types
  ui/
    settings.ts   Extension settings panel
    styles.ts     HUD, settings, and FX styles

dist/
  backend.js
  frontend.js
```

## Notes

- This extension does not use a live weather API or perform fallback generation.
- The weather is intentionally narrative/state driven.
- The HUD is meant to stay fairly small and readable over chat.
- The settings page exposes both quick prompt guidance and full manual scene controls.
