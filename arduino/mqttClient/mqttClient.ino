#include <SPI.h>
#include <UIPEthernet.h>
#include <PubSubClient.h>
#include <Servo.h>
#include <avr/wdt.h>

// LIST OF DEVICES ATTACHED TO YOUR ARDUINO
String devices[] = {"ITTS1", "ITTS2"};
// BOARD ID
String boardName = "BA11AA";
String boardsChannel = "boards";
String sensorsChannel = "sensors/BA11AA";

EthernetClient ethClient;
PubSubClient client(ethClient);
Servo TS1;
Servo TS2;
int pos;

void callback(char* topic, char* payload, unsigned int length) {
  char boardsChannelChr[7];
  boardsChannel.toCharArray(boardsChannelChr, 7);

  String command = String (payload);
  String pongCommand = "PONG::" + boardName;
  char pongCommandChr[16];
  pongCommand.toCharArray(pongCommandChr, 16);
  
  command = command.substring(0, length);
    
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("]: ");
  Serial.print(command);
  Serial.println();

  if (String(topic).equals(boardsChannel)) {
    if (command.equals("PING")) {
      client.publish(boardsChannelChr, pongCommandChr);
    }
  
    if (command.equals("REGISTER")) {
      registerBoard();
    }
  }

  if (String(topic).equals(sensorsChannel)) {
    if (command.equals("ITTS1::open")) {
      left(TS1);
    }
    if (command.equals("ITTS1::close")) {
      right(TS1);
    }

    if (command.equals("ITTS2::open")) {
      left(TS2);
    }
    if (command.equals("ITTS2::close")) {
      right(TS2);
    }
  }
}

void registerBoard() {
  char registerCommandChr[90];
  char boardsChannelChr[7];
  boardsChannel.toCharArray(boardsChannelChr, 7);
  char sensorsChannelChr[15];
  sensorsChannel.toCharArray(sensorsChannelChr, 15);
  String registerCommand = "REGISTER::" + boardName + "::" + devices[0] + "::" + devices[1];
  registerCommand.toCharArray(registerCommandChr, 90);
  client.publish(boardsChannelChr, registerCommandChr);
  Serial.println("SEND: " + registerCommand);
}

void reconnect() {
  char boardsChannelChr[7];
  boardsChannel.toCharArray(boardsChannelChr, 7);
  char sensorsChannelChr[15];
  sensorsChannel.toCharArray(sensorsChannelChr, 15);
  // Loop until we're reconnected
  while (!client.connected()) {
    
    
    Serial.print("Attempting MQTT connection...");
    // Attempt to connect
    if (client.connect("arduinoClient")) {
      Serial.println("connected");
      client.subscribe(boardsChannelChr);
      client.subscribe(sensorsChannelChr);
      registerBoard();
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}

void setup()
{
  wdt_disable();
  byte mac[]    = {  0xDE, 0xED, 0xBA, 0xFE, 0xFE, 0xED };
  IPAddress ip(192, 168, 1, 202);
  IPAddress server(192, 168, 1, 156);
  Serial.print("Ethernet Begin");
  Serial.begin(9600);
  Ethernet.begin(mac, ip);
  Serial.print("IP Address: ");
  Serial.println(Ethernet.localIP());
  client.setServer(server, 1883);
  client.setCallback(callback);

  TS1.attach(9); 
  TS2.attach(10); 
  // Allow the hardware to sort itself out
  delay(2000);
  wdt_enable(WDTO_8S);
}

void loop()
{
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  wdt_reset();
}

void right(Servo drive) {
  for (pos = 160; pos >= 20; pos -= 3) {
    drive.write(pos);
    delay(10);
  }
  Serial.println("Turn RIGHT");
}
void left(Servo drive) {
 for (pos = 20; pos <= 160; pos += 3) {
    drive.write(pos);
    delay(10);
  }  
  Serial.println("Turn LEFT");
}
