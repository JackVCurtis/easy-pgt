import { render } from "@testing-library/react-native";

import HandshakeScreen from "@/app/(tabs)/handshake";

describe("Handshake flow", () => {
  it("shows only the two pre-init handshake actions", () => {
    const { getByText, queryByText } = render(<HandshakeScreen />);

    expect(getByText("Offer Hand")).toBeTruthy();
    expect(getByText("Accept Handshake")).toBeTruthy();

    expect(queryByText("Start Handshake")).toBeNull();
    expect(queryByText("Continue to QR exchange")).toBeNull();
    expect(queryByText("Start Another Handshake")).toBeNull();
  });

  it("uses a scrollable column layout to avoid overlapping handshake content", () => {
    const { getByTestId } = render(<HandshakeScreen />);

    const scrollColumn = getByTestId("handshake-scroll-column");

    expect(scrollColumn.props.contentContainerStyle).toEqual(
      expect.objectContaining({
        flexGrow: 1,
        justifyContent: "space-between",
        alignItems: "stretch",
      }),
    );
  });
});
