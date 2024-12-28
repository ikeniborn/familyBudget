# https://outline-vpn.com/#download-outline
sudo bash -c "$(wget -qO- https://outline-vpn.com/install-server.php)"

To manage your Outline server, please copy the following line (including curly
brackets) into Step 2 of the Outline Manager interface:

{"apiUrl":"https://45.129.78.91:13787/jVjm_6zICECxlDwGowVlbA","certSha256":"D5B4DE5F09120D3E02466A08FD8411CBD9BB05B8B855388AB6761A037BAD2EB9"}

If you have connection problems, it may be that your router or cloud provider
blocks inbound connections, even though your machine seems to allow them.

Make sure to open the following ports on your firewall, router or cloud provider:
- Management port 13787, for TCP
- Access key port 24417, for TCP and UDP
