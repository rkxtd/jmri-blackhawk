#include <SPI.h>
#include <UIPEthernet.h>
#include <PubSubClient.h>
#include <Servo.h>
#include <avr/wdt.h>
#include <JmriBlackhawk.h>

// Update these with values suitable for your network.
String devices[] = {"ITTS1", "ITTS2"};
String boardName = "BA11AA";
String boardsChannel = "boards";
String sensorsChannel = "sensors/BA11AA";

EthernetClient ethClient;
PubSubClient client(ethClient);
Servo TS1;
Servo TS2;
JmriBlackhawk Jmri = JmriBlackhawk(boardsChannel, sensorsChannel, boardName, client, devices);

void setup()
{
  byte mac[]    = {  0xDE, 0xED, 0xBA, 0xFE, 0xFE, 0xED };
  IPAddress server(192, 168, 1, 156);
  Serial.print("Ethernet Begin");
  Serial.begin(9600);
  Ethernet.begin(mac);
  Serial.print("IP Address: ");
  Serial.println(Ethernet.localIP());
  client.setServer(server, 1883);
  client.setCallback(callback);

  TS1.attach(9);
  TS2.attach(10);

  // Allow the hardware to sort itself out
  delay(2000);
}

void loop()
{
  if (!client.connected()) {
    Jmri.reconnect();
  }
  client.loop();
}

void callback(char* topic, char* payload, unsigned int length) {
  String command = Jmri.captureCommand(topic, payload, length);
  if (String(topic).equals(sensorsChannel)) {
    if (command.equals("ITTS1::open"))
        Jmri.servoLeft(TS1);
    else if (command.equals("ITTS1::close"))
        Jmri.servoRight(TS1);
    else if (command.equals("ITTS2::open"))
        Jmri.servoLeft(TS2);
    else if (command.equals("ITTS2::close"))
        Jmri.servoRight(TS2);
  }
}