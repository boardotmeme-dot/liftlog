# Install liftlog on your phone

liftlog is a **web app that installs like a normal app**: its own icon on your Home Screen, full screen without browser bars, works offline in the gym. There is nothing to download from an app store.

First you need your own copy running, see [SETUP.md](SETUP.md). (To just try it, the public demo works the same way.)

## iPhone and iPad

1. Open your liftlog address in **Safari**.
2. Tap the **Share** button (the square with an arrow, bottom centre).
3. Scroll down and tap **Add to Home Screen**.
4. Keep the name, tap **Add**.
5. Open liftlog **from the new Home Screen icon**.
6. Go to **More → Account** and **sign in inside this app**. (The Home Screen app has its own storage, separate from Safari, so you sign in once there.)

Done. From now on every workout syncs to your own database.

**Good to know on iPhone**

* On iOS 16.4 and later, Chrome and Edge can add to the Home Screen as well, from their share menu. Safari is the most reliable.
* **Install it.** Safari may clear the stored data of websites you have not opened for a week. Apps added to the Home Screen are not affected. Signing in also keeps your history safe on your server.
* **Vibration is not available** in iPhone web apps (an Apple limitation). The rest timer shows a green bar and plays a short **beep** when time is up. The beep is silenced by the ringer switch, so flip it to ring if you want to hear it.
* The screen stays **awake during a workout** (iOS 16.4+).
* To update, just open the app. New versions load in the background and appear the next time you launch it.
* To remove it: touch and hold the icon → **Remove App**. Your data in Supabase is untouched.

## Android

1. Open your address in **Chrome**.
2. Tap **⋮ → Install app** (or **Add to Home screen**).
3. Open liftlog from the new icon and sign in under **More → Account**.

On Android the rest timer also **vibrates**.

## Computer

In Chrome or Edge click the **install icon** at the right end of the address bar, or **⋮ → Save and share → Install**. It opens in its own window.

## Using it in the gym without signal

Open the app once with a connection so it can store itself. After that:

* You can start workouts, tick sets and finish them with no signal at all. Everything is saved on the phone.
* When you are back online the app uploads the new workouts by itself (watch **More → Account** for the time of the last sync).

## Troubleshooting

| Problem | Fix |
|---|---|
| No "Add to Home Screen" in the share sheet | You are in an in-app browser (a link opened from Instagram, Telegram, etc.). Open the address in Safari. |
| The Home Screen app shows an empty plan | You are not signed in inside it yet. **More → Account → Sign in**. |
| Old version after an update | Fully close the app (swipe it away) and open it again. |
| The icon is blank or a screenshot of the page | Delete it and add it again after the site has loaded completely. |
| Beep does not play | Tick any set first (sound is unlocked by a tap), check the ringer switch, and that **More → Rest timer → Beep** is on. |
