# install nginx
apt install -y nginx
cp ./inimatic_nginx.conf /etc/nginx/conf.d/
systemctl enable nginx
# install redis
apt update
apt install -y redis-server
systemctl enable --now redis-server
# clone repository
mkdir /var/www/inimatic
apt install -y git
git clone https://github.com/stipot/inimatic.git /var/www/inimatic/
cd /var/www/inimatic/
# install dependencies
npm i
