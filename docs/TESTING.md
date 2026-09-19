# TruckLog: test guide

**App:** https://trucklog-web.vercel.app · allow about 40 minutes.

This guide lists what to enter, what you should see, and why each part matters to the person using it: a truck driver or dispatcher planning a trip.

---

## 1. Who uses it and what it solves

A truck driver in the US may only drive and work a limited number of hours (the FMCSA *Hours of Service* rules). Before each trip, the driver or dispatcher has to answer:

- Can this trip be done legally, and when will the truck arrive?
- Where must the driver stop for fuel, breaks and sleep?
- What will the driver's daily log sheet look like for each day?

Today this is worked out by hand with a calculator and a paper log. TruckLog does it in a few seconds and fills in the log sheets.

---

## 2. What you enter

### Trip (required)

| Field | What it means | Example | Why the app needs it |
|---|---|---|---|
| Current location | Where the truck is right now | `Chicago, IL` | Start of the route; its time zone becomes the home-terminal time on the logs |
| Pickup | Where the load is picked up | `St. Louis, MO` | Adds 1 hour of on-duty time (loading) |
| Dropoff | Where the load is delivered | `Dallas, TX` | Adds 1 hour of on-duty time (unloading) |
| Cycle hours used | Hours the driver has already worked in the last 8 days (0–70) | `12.5` | The law allows 70 hours in 8 days. This sets how much time is left before a 34-hour restart is forced. |
| Departure | When the trip starts, in local time at the truck | today 06:00 | Places every stop at real clock times and splits the logs into calendar days |

Type a place and pick a suggestion, or type the full city and state and submit; the server looks it up.

### Log sheet details (optional)

In the form under **Log sheet details → Add**, or later above the sheets under **Sheet details**.

| Field | Example | Printed on the sheet at |
|---|---|---|
| Driver name | `Jai Surya` | Bottom right, "Driver's name" |
| Carrier name | `Northline Transport` | Top right, "Name of Carrier or Carriers" |
| Main office address | `2200 W Lake St, Chicago, IL` | Top right, "Main Office Address" |
| Home terminal address | `Chicago, IL` | Top right, "Home Terminal Address" |
| Truck / trailer numbers | `T-418 / TR-2207` | Top left, under the mileage boxes |
| Manifest or BOL number | `BOL-55120` | Bottom left, "DVL or Manifest No." |
| Shipper and commodity | `Acme Foods, packaged goods` | Bottom left, "Shipper & Commodity" |

Fields left empty print as blank lines, like the paper form.

---

## 3. Test cases

The expected values below were measured on the live app. Miles can move by a few miles depending on the exact spot the map picks for a city. Clock times depend on the departure you choose; use **06:00** to match the tables.

### Test 1: Short trip, one day

| Enter | |
|---|---|
| Current / Pickup / Dropoff | Dallas, TX / Fort Worth, TX / Austin, TX |
| Cycle hours used | 0 |

**Expect**

- About **221 mi**, **6h 15m driving**, **8h 15m on duty**, **1 day**.
- "No rests needed". The itinerary shows drive → pickup → drive → dropoff only.
- One log sheet totalling **24 h**.

**Why it matters:** for a short run, the driver immediately sees that no rest is needed, and gets a finished log for the day.

### Test 2: Multi-day trip (the main case)

| Enter | |
|---|---|
| Current / Pickup / Dropoff | Chicago, IL / St. Louis, MO / Dallas, TX |
| Cycle hours used | 12.5 |
| Departure | a future date, 06:00 |

**Expect: summary**

- About **964–971 mi**, **22h 30m driving**, **3 days**, **1 break, 2 rests**.

**Expect: itinerary**

- Drive about 301 mi to St. Louis, then pickup (1 h on duty).
- Driving stops after 11 h in total, then a **10-hr sleeper-berth rest**.
- The next day, a **30-minute break** after 8 h of driving.
- Dropoff in Dallas (1 h on duty).

**Expect: Day 1 log sheet**

| Row | Hours |
|---|---|
| Off duty | 6 |
| Sleeper berth | 6 |
| Driving | 11 |
| On duty (not driving) | 1 |
| **Total** | **24** |

- Miles driven today: about **464**. From: Chicago, IL. To: the city where the rest is.
- Recap: **12** on duty today, **24.5** total in the cycle, **45.5** available tomorrow.
- Remarks: a slanted city name at every change of status (Chicago, St. Louis pickup, the rest stop).

**Why it matters:** the driver gets a legal schedule with the arrival time, knows where they'll sleep, and has log sheets ready to carry. Planning this by hand takes much longer and is easy to get wrong.

### Test 3: Driver almost out of hours (forced 34-hour restart)

| Enter | |
|---|---|
| Current / Pickup / Dropoff | Atlanta, GA / Nashville, TN / Denver, CO |
| Cycle hours used | 62 |

**Expect**

- About **1,401 mi**, **33h 30m driving**, **5 days**.
- Stops: **1 fuel stop, 1 break, 2 rests, 1 restart**.
- An orange notice: "The 70-hr cycle runs out mid-trip, so the plan includes a 34-hr restart".
- The itinerary shows a **34-hr restart** shortly after the pickup.
- One day is almost entirely **Off duty**. Its sheet has a remark at midnight explaining the restart.
- On the day the restart ends, "available tomorrow" goes back up.

**Why it matters:** this is the case people most often get wrong by hand. The app shows the driver *before* dispatch that the load arrives days later than a naive estimate, so the dispatcher can reassign the load or reset expectations with the customer.

### Test 4: Long haul with fuel stops

| Enter | |
|---|---|
| Current / Pickup / Dropoff | New York, NY / Chicago, IL / Los Angeles, CA |
| Cycle hours used | 30 |

**Expect**

- About **2,810 mi**, **65h 15m driving**, **7 days**.
- **2 fuel stops**, each before 1,000 miles since the last one, and 30 min on duty.
- 3 breaks, 5 rests, 1 restart.
- Seven log sheets, each totalling 24 h.

**Why it matters:** long-haul planning (fuel, sleep and the weekly cycle together) is where the tool saves the most time.

### Test 5: Sheet details

1. Plan Test 2, open the **Daily logs** tab and expand **Sheet details**.
2. Enter a driver name, carrier, truck/trailer numbers and a BOL number.

**Expect**

- Each value appears on the sheet as you type, in the right box (see section 2), on **every** day's sheet.
- Fields you left empty stay as blank lines.

3. Reload the page and plan a new trip.

**Expect**

- The driver, carrier, offices and truck are still filled in; the BOL and shipper are empty again.

**Why it matters:** the sheets are ready to sign and hand over, not a mock-up. The driver sets carrier, truck and name once, not on every trip, and enters shipping details per load, as in real life.

### Test 6: Print and share

1. On the Daily logs tab, click **Print logs**.

   **Expect:** landscape pages, **one sheet per page**, with no website header, form or map. The page count equals the number of days, and "Save as PDF" works.

2. Click **Share link**, then open the link in a new window.

   **Expect:** the same trip is planned again with the same sheet details.

**Why it matters:** drivers must keep 8 days of logs, and dispatchers work with others. A PDF or a link is how the plan leaves the app.

### Test 7: Mistakes and bad input

| Do this | Expect |
|---|---|
| Plan with all fields empty | Messages under each field, e.g. "Enter where the truck is now." Nothing is sent. |
| Cycle hours used = `71` | "Enter a number from 0 to 70." |
| Dropoff = `asdfghjkl` | "We couldn't find 'asdfghjkl'. Try a city and state." and a **Try again** link |
| Dropoff = `London` (the UK one) | A clear message that no drivable route connects the places |
| Click **Edit trip** after planning | The form returns with everything filled in |

**Why it matters:** a user who makes a typo is told exactly what to fix, and never loses what they already typed.

---

## 4. Checks that prove the logs are correct

For every trip you plan, confirm:

- [ ] Each sheet's four totals add up to exactly **24**.
- [ ] The duty line on the grid matches the itinerary times.
- [ ] No more than **11 h** of driving without a 10-h rest in between.
- [ ] A **30-min** break (or a 30-min+ stop) appears before driving goes past 8 h.
- [ ] No driving after **14 h** from the start of the duty day.
- [ ] A **fuel stop** at least every 1,000 miles.
- [ ] Pickup and dropoff each show **1 h** on duty.
- [ ] When cycle hours would pass 70, there is a **34-h restart**.

Note: one calendar day can show more than 11 h of driving when it spans two duty periods with a 10-hour rest between them. That's legal, and the app explains it on that sheet.

---

## 5. Screen sizes

- **Phone (about 390 px):** in the browser's device toolbar, the form stacks in one column with no sideways scrolling. The log sheet scrolls sideways inside its frame.
- **Desktop (1440 px):** the form and rules sit side by side; the map sits next to the itinerary.

---

## 6. Reporting a problem

Note the steps, the URL (it holds the whole trip), what you expected and what you saw. Include any red errors from the browser console (F12 → Console).
