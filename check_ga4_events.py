#!/usr/bin/env python3
"""
Check GA4 Events and Conversions
Lists all tracked events and their counts to see what's available.
"""
import os
import pickle
from datetime import datetime, timedelta
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    RunReportRequest,
    DateRange,
    Dimension,
    Metric,
    OrderBy,
)

GA_PROPERTY_ID = '463761214'
SCOPES = ['https://www.googleapis.com/auth/analytics.readonly']

def get_credentials():
    """Get OAuth credentials"""
    creds = None
    if os.path.exists('ga_token.pickle'):
        with open('ga_token.pickle', 'rb') as token:
            creds = pickle.load(token)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file('client_secrets.json', SCOPES)
            creds = flow.run_local_server(port=0)
        with open('ga_token.pickle', 'wb') as token:
            pickle.dump(creds, token)
    return creds

def main():
    print("=" * 70)
    print("GA4 Events Check")
    print("=" * 70)

    creds = get_credentials()
    client = BetaAnalyticsDataClient(credentials=creds)

    # Get events from last 90 days
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')

    print(f"\nChecking events from {start_date} to {end_date}...\n")

    # Query for all event names and their counts
    request = RunReportRequest(
        property=f"properties/{GA_PROPERTY_ID}",
        date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
        dimensions=[
            Dimension(name="eventName"),
            Dimension(name="isConversionEvent"),  # Shows if marked as conversion
        ],
        metrics=[
            Metric(name="eventCount"),
        ],
        order_bys=[
            OrderBy(metric=OrderBy.MetricOrderBy(metric_name="eventCount"), desc=True)
        ],
        limit=100
    )

    response = client.run_report(request)

    conversions = []
    other_events = []

    for row in response.rows:
        event_name = row.dimension_values[0].value
        is_conversion = row.dimension_values[1].value == "true"
        count = int(row.metric_values[0].value)

        if is_conversion:
            conversions.append((event_name, count))
        else:
            other_events.append((event_name, count))

    # Print conversions
    print("CONVERSION EVENTS (marked as conversions in GA4)")
    print("-" * 50)
    if conversions:
        for name, count in conversions:
            print(f"  {name:40} {count:>8,}")
    else:
        print("  (No conversion events configured)")

    # Print other events
    print("\n\nOTHER TRACKED EVENTS")
    print("-" * 50)

    # Group by likely category
    call_events = []
    form_events = []
    click_events = []
    page_events = []
    other = []

    for name, count in other_events:
        name_lower = name.lower()
        if 'call' in name_lower or 'phone' in name_lower or 'tel:' in name_lower:
            call_events.append((name, count))
        elif 'form' in name_lower or 'submit' in name_lower or 'schedule' in name_lower or 'book' in name_lower or 'contact' in name_lower:
            form_events.append((name, count))
        elif 'click' in name_lower or 'cta' in name_lower:
            click_events.append((name, count))
        elif 'page' in name_lower or 'view' in name_lower or 'scroll' in name_lower:
            page_events.append((name, count))
        else:
            other.append((name, count))

    if call_events:
        print("\n  PHONE/CALL RELATED:")
        for name, count in call_events:
            print(f"    {name:38} {count:>8,}")

    if form_events:
        print("\n  FORM/BOOKING RELATED:")
        for name, count in form_events:
            print(f"    {name:38} {count:>8,}")

    if click_events:
        print("\n  CLICK EVENTS:")
        for name, count in click_events:
            print(f"    {name:38} {count:>8,}")

    if page_events:
        print("\n  PAGE/VIEW EVENTS:")
        for name, count in page_events[:10]:  # Limit to top 10
            print(f"    {name:38} {count:>8,}")
        if len(page_events) > 10:
            print(f"    ... and {len(page_events) - 10} more page events")

    if other:
        print("\n  OTHER:")
        for name, count in other[:15]:  # Limit to top 15
            print(f"    {name:38} {count:>8,}")
        if len(other) > 15:
            print(f"    ... and {len(other) - 15} more events")

    print("\n" + "=" * 70)
    print("RECOMMENDATIONS:")
    print("-" * 70)
    print("""
Events you likely want to track as conversions:
- Scheduler/booking completions (look for 'schedule', 'book', 'appointment')
- Phone calls (click-to-call events, tel: link clicks)
- Form submissions (contact form, quote request)
- Text/SMS clicks (if tracked)

To mark an event as a conversion in GA4:
1. Go to GA4 Admin > Events
2. Find the event
3. Toggle 'Mark as conversion' ON

Or go to Admin > Conversions > New conversion event
""")

if __name__ == "__main__":
    main()
