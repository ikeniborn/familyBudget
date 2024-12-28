CONGRATULATIONS! Your Outline server is up and running.

To manage your Outline server, please copy the following line (including curly
brackets) into Step 2 of the Outline Manager interface:

{"apiUrl":"https://34.143.208.151:20329/ut_S4dlhQlNjU7yxPRGYBA","certSha256":"5BA86C82AA30535F334C1FBB30C8D1451FB2DFFA23DD8B68BC9CD2576F35DDCD"}

You won’t be able to access it externally, despite your server being correctly
set up, because there's a firewall (in this machine, your router or cloud
provider) that is preventing incoming connections to ports 20329 and 18572.

Make sure to open the following ports on your firewall, router or cloud provider:
- Management port 20329, for TCP
- Access key port 18572, for TCP and UDP