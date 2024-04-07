# add the git hook
# echo 'bash generate-thumbs.sh' > .git/hooks/pre-commit

rm -rf static/thumbs/artwork
mkdir -p static/thumbs/artwork
cp static/artwork/*.jpg static/thumbs/artwork
pushd static/thumbs/artwork
mogrify -resize 400 *.jpg
git add *.jpg
popd
