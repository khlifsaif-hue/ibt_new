# SmartCare V5.5.1

## Access Control patch
- Fixed React `Received NaN for the value attribute` error on the Access Control user selector.
- User selector now treats user IDs as strings instead of coercing them with `Number(...)`.
- Added a defensive string value for the controlled `<select>`.
- Preserved V5.5 Finance approval engine and all existing functionality.
