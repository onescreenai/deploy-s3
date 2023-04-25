# deploy-s3
Deploys to s3 bucket

Use Example:
```yaml
    - uses: onescreenai/deploy-s3
      id: s3deploy
      with:
        aws_access_key_id: ${{ secrets.AWS_KEY_ID }}
        aws_secret_access_key: ${{ secrets.AWS_SECRET_ACCESS_KEY}}
        region: ${{ secrets.AWS_REGION }}
        bucket: ${{ secrets.AWS_BUCKET }}
        source_path: 'dist/'
        destination_path: 'scripts'
    - name:
      run: |
        echo $OBJECT_KEY;
      env:
        OBJECT_KEY: ${{ steps.s3deploy.outputs.object_key }}
```

