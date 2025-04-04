# Inari Assistant Backend (TypeScript)

This is a TypeScript implementation of the Inari Assistant backend, using Express framework and WebSockets for real-time communication.

## Features

- **Call Handling**: Process inbound and outbound calls with Twilio
- **Voice Assistant**: Integrate with OpenAI's real-time audio API for natural conversation
- **Call Screening**: Intelligently screen calls and determine their importance
- **Call Transfer**: Transfer calls to the appropriate recipient
- **Scheduling**: Send calendar links for scheduling meetings
- **Calendar Integration**: Check availability using Google Calendar API

## Prerequisites

- Node.js 18+
- npm or yarn
- Twilio account with phone number
- OpenAI API key
- Google API credentials for Calendar access

## Environment Setup

1. Copy `.env.example` to `.env`
2. Fill in your API keys and configuration values
3. Place your Google API credentials in `credentials.json` in the project root

## Installation
