# add the git hook
# echo 'bash generate-thumbs.sh' > .git/hooks/pre-commit

rm -rf static/artwork/thumbs
mkdir -p static/artwork/thumbs
cp static/artwork/*.jpg static/artwork/thumbs
pushd static/artwork/thumbs
mogrify -resize 400 *.jpg
git add *.jpg
popd
